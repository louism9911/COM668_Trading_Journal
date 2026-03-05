"""
Globals - Shared Configuration
================================
"""

from pymongo import MongoClient


def normalize_open_time(dt_str):
    """
    Normalize a datetime string to ISO 8601 format so that
    $dateFromString in the analytics pipeline can parse it.
    
    """
    if not dt_str or not dt_str.strip():
        return ''
    s = dt_str.strip()
    # Replace the two date-separator dots then the space before the time
    return s.replace('.', '-', 2).replace(' ', 'T', 1)


# Secret key for JWT
SECRET_KEY = 'TradeHubSecretKey123@'

# MongoDB Connection
client = MongoClient("mongodb://127.0.0.1:27017")
db = client.tradingDB

# Collections
users = db.users
trades = db.trades
blacklist = db.blacklist
