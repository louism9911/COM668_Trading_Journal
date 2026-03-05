"""
Uploads Blueprint
==================
Handles HTML broker statement file uploads.
Parses MT4/MT5 HTML trade history using BeautifulSoup.
"""

from flask import Blueprint, request, jsonify, make_response
from bs4 import BeautifulSoup
import datetime
import logging
import globals
from decorators import jwt_required

logger = logging.getLogger('tradehub')

# Create blueprint
uploads_bp = Blueprint('uploads', __name__)

ALLOWED_EXTENSIONS = {'html', 'htm'}

# Column header text -> internal field name.
# Covers both MT4 ('Ticket', 'Open Time', 'Close Time') and
# MT5 Positions ('Position', duplicate 'Time' handled separately).
COLUMN_MAP = {
    'ticket':     'ticket',
    'position':   'ticket',      # MT5 Positions section
    'open time':  'open_time',   # MT4 / MT5 Orders section
    'close time': 'close_time',  # MT4
    'type':       'type',
    'size':       'lots',
    'volume':     'lots',
    'item':       'symbol',
    'symbol':     'symbol',
    's / l':      'sl',
    's/l':        'sl',
    't / p':      'tp',
    't/p':        'tp',
    'commission': 'commission',
    'taxes':      'taxes',
    'swap':       'swap',
    'profit':     'profit',
}

# Only import closed buy/sell trades
TRADE_TYPES = {'buy', 'sell'}


def allowed_file(filename):
    """Check file extension is HTML."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def decode_html(raw_bytes):
    """
    Decode raw file bytes to a string.
    MT5 exports are saved as UTF-16 LE with a BOM (FF FE).
    MT4 exports are typically UTF-8.
    """
    if raw_bytes.startswith(b'\xff\xfe') or raw_bytes.startswith(b'\xfe\xff'):
        return raw_bytes.decode('utf-16')
    return raw_bytes.decode('utf-8', errors='replace')


def clean_number(value):
    """
    Parse MT4/MT5-formatted numbers.
    Strips spaces used as thousand separators (e.g. '2 655.30' -> 2655.30).
    Returns 0.0 on failure.
    """
    if not value or not value.strip():
        return 0.0
    try:
        return float(value.strip().replace(' ', ''))
    except (ValueError, TypeError):
        return 0.0


def normalize_datetime(dt_str):
    """
    Convert MT4/MT5 datetime strings to ISO 8601 format so they are
    parseable by JavaScript's Date constructor in the frontend.

    MT4/MT5 export format : '2026.03.04 14:03:28'
    ISO 8601 (no offset)  : '2026-03-04T14:03:28'

    No timezone conversion is performed — times are stored in broker
    server time, exactly as exported, since the UTC offset is not
    embedded in the file and varies per broker.
    """
    if not dt_str or not dt_str.strip():
        return ''
    # Replace the two date-separator dots and the space before the time
    return dt_str.strip().replace('.', '-', 2).replace(' ', 'T', 1)


def find_header_row(rows):
    """
    Locate the trade data header row in a table.

    Detects both:
      - MT4 format: contains 'Ticket' and 'Profit'
      - MT5 Positions format: contains 'Position' and 'Profit'

    Builds a column index map, handling the duplicate 'Price' columns
    (open price / close price) and duplicate 'Time' columns in MT5
    (open time / close time).

    Returns (header_row_index, col_map) or (None, None).
    """
    for i, row in enumerate(rows):
        cells = row.find_all(['td', 'th'])
        cell_texts = [c.get_text(strip=True).lower() for c in cells]

        # 'ticket' = MT4 | 'position' = MT5 Positions section
        has_ticket = any(t in ('ticket', 'position') for t in cell_texts)
        has_profit = any('profit' in t for t in cell_texts)

        if not (has_ticket and has_profit):
            continue

        # Build initial col_map from COLUMN_MAP lookup
        col_map = {}
        for idx, text in enumerate(cell_texts):
            if text in COLUMN_MAP:
                col_map[COLUMN_MAP[text]] = idx

        # Handle two 'price' columns: first = open price, second = close price
        price_indices = [idx for idx, t in enumerate(cell_texts) if t == 'price']
        if len(price_indices) >= 2:
            col_map['open_price'] = price_indices[0]
            col_map['close_price'] = price_indices[1]
        elif len(price_indices) == 1:
            col_map['open_price'] = price_indices[0]

        # Handle two 'time' columns in MT5 Positions: first = open, second = close
        time_indices = [idx for idx, t in enumerate(cell_texts) if t == 'time']
        if len(time_indices) >= 2:
            col_map['open_time'] = time_indices[0]
            col_map['close_time'] = time_indices[1]
        elif len(time_indices) == 1 and 'open_time' not in col_map:
            col_map['open_time'] = time_indices[0]

        return i, col_map

    return None, None


def parse_trade_row(cells, col_map):
    """
    Extract trade data from a single table row using the column mapping.

    MT5 Positions rows contain a hidden spacer cell
    (<td class="hidden" colspan="8">) that shifts all subsequent column
    indices. These are filtered out before applying the col_map so that
    indices align with the header row.

    Returns a trade dict, or None if the row should be skipped.
    """
    # Filter out MT5 hidden spacer cells before index lookup
    visible_cells = [c for c in cells if 'hidden' not in c.get('class', [])]

    def get_cell(field):
        if field in col_map and col_map[field] < len(visible_cells):
            return visible_cells[col_map[field]].get_text(strip=True)
        return ''

    # Skip non-trade rows (balance, credit, deposit, withdrawal, section headers)
    trade_type = get_cell('type').lower().strip()
    if trade_type not in TRADE_TYPES:
        return None

    # Skip rows with no symbol
    symbol = get_cell('symbol').strip().upper()
    if not symbol:
        return None

    return {
        'ticket':      get_cell('ticket').strip(),
        'symbol':      symbol,
        'type':        trade_type,
        'lots':        clean_number(get_cell('lots')),
        'open_time':   normalize_datetime(get_cell('open_time')),
        'close_time':  normalize_datetime(get_cell('close_time')),
        'open_price':  clean_number(get_cell('open_price')),
        'close_price': clean_number(get_cell('close_price')),
        'sl':          clean_number(get_cell('sl')),
        'tp':          clean_number(get_cell('tp')),
        'commission':  clean_number(get_cell('commission')),
        'swap':        clean_number(get_cell('swap')),
        'profit':      clean_number(get_cell('profit')),
        'tags':        [],
    }


@uploads_bp.route("/api/v1.0/trades/upload/html", methods=['POST'])
@jwt_required
def upload_html(current_user):
    """
    Upload and parse an MT4/MT5 HTML trade history export.
    The file is parsed in memory, not stored permanently.
    """

    # ─── Step 1: Validate file is present ────────────────
    if 'file' not in request.files:
        return make_response(jsonify({
            'error': 'No file provided',
            'message': 'Please select an HTML file to upload.'
        }), 400)

    file = request.files['file']

    if file.filename == '':
        return make_response(jsonify({
            'error': 'No file selected',
            'message': 'Please select an HTML file to upload.'
        }), 400)

    # ─── Step 2: Validate file extension ─────────────────
    if not allowed_file(file.filename):
        return make_response(jsonify({
            'error': 'Invalid file type',
            'message': 'Only HTML (.html, .htm) files are allowed.'
        }), 400)

    # ─── Step 3: Read and decode HTML ────────────────────
    # MT5 exports use UTF-16 LE (BOM: FF FE); MT4 uses UTF-8.
    try:
        raw = file.read()
        html_content = decode_html(raw)
    except Exception:
        return make_response(jsonify({
            'error': 'Failed to read file',
            'message': 'The file could not be read. Please ensure it is a valid HTML file.'
        }), 400)

    soup = BeautifulSoup(html_content, 'html.parser')

    # ─── Step 4: Locate trade table ───────────────────────
    tables = soup.find_all('table')
    if not tables:
        return make_response(jsonify({
            'error': 'Invalid file structure',
            'message': 'No tables found in the HTML file. '
                       'Please upload a valid MetaTrader trade history export.'
        }), 400)

    header_idx = None
    col_map = None
    target_rows = None

    for table in tables:
        rows = table.find_all('tr')
        header_idx, col_map = find_header_row(rows)
        if header_idx is not None:
            target_rows = rows
            break

    if header_idx is None or col_map is None:
        return make_response(jsonify({
            'error': 'Unrecognised file format',
            'message': 'Could not find trade history headers (Ticket/Position, Type, Profit). '
                       'Please upload a valid MT4 or MT5 HTML statement export.'
        }), 400)

    # ─── Step 5: Validate minimum required columns ────────
    required_columns = {'type', 'symbol', 'profit'}
    missing = required_columns - set(col_map.keys())
    if missing:
        return make_response(jsonify({
            'error': 'Missing columns',
            'message': f'The file is missing required columns: {", ".join(missing)}. '
                       f'Please upload a complete MetaTrader HTML report.'
        }), 400)

    # ─── Step 6: Parse trade rows ─────────────────────────
    parsed_trades = []
    skipped_rows = 0

    for row in target_rows[header_idx + 1:]:
        # MT5 files contain multiple sections (Positions, Orders, Deals)
        # in one table. Section marker rows use <th> elements — stop there
        # to avoid parsing Orders/Deals rows with the Positions col_map.
        if row.find('th'):
            break

        cells = row.find_all('td')
        if len(cells) < 3:
            continue

        trade = parse_trade_row(cells, col_map)
        if trade is None:
            skipped_rows += 1
            continue

        trade['user_id'] = str(current_user['_id'])
        trade['source'] = 'upload'
        trade['created_at'] = datetime.datetime.now(datetime.timezone.utc)
        parsed_trades.append(trade)

    # ─── Step 7: Validate results ─────────────────────────
    if len(parsed_trades) == 0:
        logger.warning('UPLOAD EMPTY  user="%s"  file="%s"', str(current_user['_id']), file.filename)
        return make_response(jsonify({
            'error': 'No trades found',
            'message': 'The file was parsed but contained no valid trade rows. '
                       'Balance, credit, and deposit entries are excluded. '
                       'Please ensure the file contains closed trade records.'
        }), 400)

    # ─── Step 8: Insert into MongoDB ──────────────────────
    result = globals.trades.insert_many(parsed_trades)

    # ─── Step 9: Return success response ──────────────────
    logger.info('UPLOAD SUCCESS  user="%s"  file="%s"  imported=%d  skipped=%d',
                str(current_user['_id']), file.filename,
                len(result.inserted_ids), skipped_rows)
    return make_response(jsonify({
        'message': f'Successfully imported {len(result.inserted_ids)} trades',
        'trades_imported': len(result.inserted_ids),
        'trades_skipped': skipped_rows,
        'trade_ids': [str(tid) for tid in result.inserted_ids]
    }), 201)
