"""
Analytics Blueprint
====================
"""

from flask import Blueprint, request, jsonify, make_response
import datetime

try:
    from backend import globals
    from backend.decorators import jwt_required, admin_required
except ModuleNotFoundError:
    import globals
    from decorators import jwt_required, admin_required

# Create blueprint
analytics_bp = Blueprint('analytics', __name__)


# ─── Helpers ──────────────────────────────────────────────────────────────────

_EPOCH = datetime.datetime(1970, 1, 1)
_FAR   = datetime.datetime(9999, 12, 31)


def _parse_open_time(sentinel):
    """
    Aggregation expression that converts the open_time string field to a
    BSON Date.  Returns `sentinel` when the field is absent, null, or not
    a parseable string.

    Normalises MT4/MT5 format ('2026.03.04 14:03:28') to ISO 8601
    ('2026-03-04T14:03:28') before parsing so that both uploaded trades
    and manually-entered trades are handled correctly.
    """
    # Step 1 – replace dots with dashes (MT4 date separator)
    replace_dots = {
        '$replaceAll': {
            'input':       {'$ifNull': ['$open_time', '']},
            'find':        '.',
            'replacement': '-',
        }
    }
    # Step 2 – replace the space between date and time with 'T'
    normalized = {
        '$replaceAll': {
            'input':       replace_dots,
            'find':        ' ',
            'replacement': 'T',
        }
    }
    return {
        '$dateFromString': {
            'dateString': normalized,
            'onError':    sentinel,
            'onNull':     sentinel,
        }
    }


def get_date_filter(date_from=None, date_to=None):
    """
    Build a date-range $expr filter on open_time.
    Uses $dateFromString so the comparison is date-aware rather than a
    lexicographic string compare, which breaks for empty or non-ISO values.
    date_from / date_to are expected as "YYYY-MM-DD" strings.
    """
    if not date_from and not date_to:
        return {}

    conditions = []

    if date_from:
        dt_from = datetime.datetime.strptime(date_from, '%Y-%m-%d')
        conditions.append({'$gte': [_parse_open_time(_EPOCH), dt_from]})

    if date_to:
        # Add one day so the filter is < midnight of the day AFTER date_to,
        # i.e. the full date_to day is included.
        dt_to = datetime.datetime.strptime(date_to, '%Y-%m-%d') + datetime.timedelta(days=1)
        conditions.append({'$lt': [_parse_open_time(_FAR), dt_to]})

    expr = {'$and': conditions} if len(conditions) > 1 else conditions[0]
    return {'$expr': expr}


def read_date_params():
    """Read optional date_from / date_to query params from the request."""
    return (
        request.args.get('date_from', '').strip() or None,
        request.args.get('date_to', '').strip() or None,
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@analytics_bp.route("/api/v1.0/analytics/summary", methods=['GET'])
@jwt_required
def get_summary(current_user):
    date_from, date_to = read_date_params()
    query = {'user_id': str(current_user['_id']), **get_date_filter(date_from, date_to)}
    user_trades = list(globals.trades.find(query))

    if not user_trades:
        return make_response(jsonify({
            'username':      current_user['username'],
            'total_trades':  0,
            'total_profit':  0,
            'winning_trades': 0,
            'losing_trades':  0,
            'win_rate':       0,
            'profit_factor':  None,
            'avg_win':        0,
            'avg_loss':       0,
        }), 200)

    total_trades   = len(user_trades)
    profits        = [t.get('profit', 0) for t in user_trades]
    total_profit   = sum(profits)
    winning_trades = len([p for p in profits if p > 0])
    losing_trades  = len([p for p in profits if p < 0])
    win_rate       = (winning_trades / total_trades * 100) if total_trades > 0 else 0

    # Profit factor = gross profit / gross loss
    gross_profit = sum(p for p in profits if p > 0)
    gross_loss   = abs(sum(p for p in profits if p < 0))
    profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else None

    # Average winning / losing trade
    wins   = [p for p in profits if p > 0]
    losses = [p for p in profits if p < 0]
    avg_win  = round(sum(wins)   / len(wins),   2) if wins   else 0
    avg_loss = round(sum(losses) / len(losses), 2) if losses else 0

    return make_response(jsonify({
        'username':       current_user['username'],
        'total_trades':   total_trades,
        'total_profit':   round(total_profit, 2),
        'winning_trades': winning_trades,
        'losing_trades':  losing_trades,
        'win_rate':       round(win_rate, 2),
        'profit_factor':  profit_factor,
        'avg_win':        avg_win,
        'avg_loss':       avg_loss,
    }), 200)


@analytics_bp.route("/api/v1.0/analytics/by-symbol", methods=['GET'])
@jwt_required
def get_by_symbol(current_user):
    date_from, date_to = read_date_params()
    match_stage = {'user_id': str(current_user['_id']), **get_date_filter(date_from, date_to)}

    pipeline = [
        {'$match': match_stage},
        {'$group': {
            '_id': '$symbol',
            'total_trades':  {'$sum': 1},
            'total_profit':  {'$sum': '$profit'},
            'average_profit': {'$avg': '$profit'},
            'max_profit':    {'$max': '$profit'},
            'min_profit':    {'$min': '$profit'},
            'total_lots':    {'$sum': '$lots'}
        }},
        {'$sort': {'total_profit': -1}},
        {'$project': {
            '_id': 0,
            'symbol':         '$_id',
            'total_trades':   1,
            'total_profit':   {'$round': ['$total_profit',   2]},
            'average_profit': {'$round': ['$average_profit', 2]},
            'max_profit':     {'$round': ['$max_profit',     2]},
            'min_profit':     {'$round': ['$min_profit',     2]},
            'total_lots':     {'$round': ['$total_lots',     2]},
        }}
    ]

    return make_response(jsonify(list(globals.trades.aggregate(pipeline))), 200)


@analytics_bp.route("/api/v1.0/analytics/by-month", methods=['GET'])
@jwt_required
def get_by_month(current_user):
    date_from, date_to = read_date_params()
    match_stage = {'user_id': str(current_user['_id']), **get_date_filter(date_from, date_to)}

    pipeline = [
        {'$match': match_stage},
        {'$addFields': {
            'month': {'$month': {'$toDate': '$created_at'}},
            'year':  {'$year':  {'$toDate': '$created_at'}}
        }},
        {'$group': {
            '_id': {'year': '$year', 'month': '$month'},
            'total_trades':  {'$sum': 1},
            'total_profit':  {'$sum': '$profit'},
            'winning_trades': {
                '$sum': {'$cond': [{'$gt': ['$profit', 0]}, 1, 0]}
            }
        }},
        {'$sort': {'_id.year': -1, '_id.month': -1}},
        {'$limit': 24},
        {'$project': {
            '_id': 0,
            'year':           '$_id.year',
            'month':          '$_id.month',
            'total_trades':   1,
            'total_profit':   {'$round': ['$total_profit', 2]},
            'winning_trades': 1,
            'win_rate': {
                '$round': [
                    {'$multiply': [
                        {'$divide': ['$winning_trades', '$total_trades']}, 100
                    ]}, 2
                ]
            }
        }}
    ]

    return make_response(jsonify(list(globals.trades.aggregate(pipeline))), 200)


@analytics_bp.route("/api/v1.0/analytics/by-type", methods=['GET'])
@jwt_required
def get_by_type(current_user):
    date_from, date_to = read_date_params()
    match_stage = {'user_id': str(current_user['_id']), **get_date_filter(date_from, date_to)}

    pipeline = [
        {'$match': match_stage},
        {'$group': {
            '_id':          '$type',
            'count':        {'$sum': 1},
            'total_profit': {'$sum': '$profit'},
            'avg_profit':   {'$avg': '$profit'}
        }},
        {'$project': {
            '_id': 0,
            'type':         '$_id',
            'count':        1,
            'total_profit': {'$round': ['$total_profit', 2]},
            'avg_profit':   {'$round': ['$avg_profit',   2]},
        }}
    ]

    return make_response(jsonify(list(globals.trades.aggregate(pipeline))), 200)


@analytics_bp.route("/api/v1.0/analytics/top-trades", methods=['GET'])
@jwt_required
def get_top_trades(current_user):
    date_from, date_to = read_date_params()
    limit = int(request.args.get('limit', 10))
    match_stage = {'user_id': str(current_user['_id']), **get_date_filter(date_from, date_to)}

    pipeline = [
        {'$match': match_stage},
        {'$sort': {'profit': -1}},
        {'$limit': limit},
        {'$project': {
            '_id': 0,
            'trade_id':  {'$toString': '$_id'},
            'symbol':    1,
            'type':      1,
            'profit':    {'$round': ['$profit', 2]},
            'open_time': 1,
        }}
    ]

    return make_response(jsonify(list(globals.trades.aggregate(pipeline))), 200)


@analytics_bp.route("/api/v1.0/analytics/tags", methods=['GET'])
@jwt_required
def get_tag_analytics(current_user):
    """
    Aggregate performance data from trade tags (subdocuments).
    Supports optional date_from / date_to filtering.
    """
    user_id = str(current_user['_id'])
    date_from, date_to = read_date_params()
    date_f = get_date_filter(date_from, date_to)

    base_query = {'user_id': user_id, **date_f}

    total_trades  = globals.trades.count_documents(base_query)
    tagged_trades = globals.trades.count_documents({
        **base_query,
        'tags': {'$exists': True, '$not': {'$size': 0}}
    })
    tag_coverage = round(tagged_trades / total_trades * 100, 1) if total_trades > 0 else 0

    def tag_pipeline(group_field, output_field):
        return [
            {'$match': base_query},
            {'$unwind': '$tags'},
            {'$match': {
                f'tags.{group_field}': {'$exists': True, '$nin': ['', None]}
            }},
            {'$group': {
                '_id':          f'$tags.{group_field}',
                'trade_count':  {'$sum': 1},
                'total_profit': {'$sum': '$profit'},
                'wins':         {'$sum': {'$cond': [{'$gt': ['$profit', 0]}, 1, 0]}}
            }},
            {'$project': {
                '_id': 0,
                output_field:   '$_id',
                'trade_count':  1,
                'total_profit': {'$round': ['$total_profit', 2]},
                'avg_profit': {
                    '$round': [{'$divide': ['$total_profit', '$trade_count']}, 2]
                },
                'win_rate': {
                    '$round': [
                        {'$multiply': [
                            {'$divide': ['$wins', '$trade_count']}, 100
                        ]}, 1
                    ]
                }
            }},
            {'$sort': {'trade_count': -1}}
        ]

    by_strategy   = list(globals.trades.aggregate(tag_pipeline('strategy',       'strategy')))
    by_emotion    = list(globals.trades.aggregate(tag_pipeline('emotional_state', 'emotion')))
    by_entry_type = list(globals.trades.aggregate(tag_pipeline('entry_type',      'entry_type')))

    return make_response(jsonify({
        'total_trades':  total_trades,
        'tagged_trades': tagged_trades,
        'tag_coverage':  tag_coverage,
        'by_strategy':   by_strategy,
        'by_emotion':    by_emotion,
        'by_entry_type': by_entry_type,
    }), 200)


@analytics_bp.route("/api/v1.0/analytics/admin/all-users", methods=['GET'])
@admin_required
def get_all_users_stats(current_user):
    pipeline = [
        {'$group': {
            '_id':            '$user_id',
            'total_trades':   {'$sum': 1},
            'total_profit':   {'$sum': '$profit'},
            'avg_profit':     {'$avg': '$profit'},
            'winning_trades': {
                '$sum': {'$cond': [{'$gt': ['$profit', 0]}, 1, 0]}
            }
        }},
        {'$lookup': {
            'from': 'users',
            'let':  {'user_id_str': '$_id'},
            'pipeline': [
                {'$match': {
                    '$expr': {'$eq': [{'$toString': '$_id'}, '$$user_id_str']}
                }},
                {'$project': {'username': 1}}
            ],
            'as': 'user_info'
        }},
        {'$unwind': '$user_info'},
        {'$project': {
            '_id': 0,
            'username':     '$user_info.username',
            'total_trades': 1,
            'total_profit': {'$round': ['$total_profit', 2]},
            'avg_profit':   {'$round': ['$avg_profit',   2]},
            'win_rate': {
                '$cond': [
                    {'$gt': ['$total_trades', 0]},
                    {'$round': [
                        {'$multiply': [
                            {'$divide': ['$winning_trades', '$total_trades']}, 100
                        ]}, 2
                    ]},
                    0
                ]
            }
        }},
        {'$sort': {'total_profit': -1}}
    ]

    return make_response(jsonify(list(globals.trades.aggregate(pipeline))), 200)
