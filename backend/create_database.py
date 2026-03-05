"""
Database Setup - Trade Hub
============================
Creates users and trading data for the Trade Hub API.
Also exports all trades to trades.json file.
============================
"""

from pymongo import MongoClient
import bcrypt
from bson import ObjectId
import random
from datetime import datetime, timedelta
import json

# MongoDB Connection
client = MongoClient("mongodb://127.0.0.1:27017")
db = client.tradingDB

# Collections
users = db.users
trades = db.trades
blacklist = db.blacklist

# Clear existing data
users.delete_many({})
trades.delete_many({})
blacklist.delete_many({})


# Create Users with bcrypt password hashing
user_data = [
    {
        "username": "kamile",
        "password": b"password123",
        "admin": False
    },
    {
        "username": "ciaran",
        "password": b"password123",
        "admin": False
    },
    {
        "username": "amelia",
        "password": b"password123",
        "admin": False
    },
    {
        "username": "noah",
        "password": b"password123",
        "admin": False
    },
    {
        "username": "sophia",
        "password": b"password123",
        "admin": False
    },
    {
        "username": "oliver",
        "password": b"password123",
        "admin": False
    },
    {
        "username": "isabella",
        "password": b"password123",
        "admin": False
    },
    {
        "username": "liam",
        "password": b"password123",
        "admin": False
    },
    {
        "username": "mia",
        "password": b"password123",
        "admin": False
    },
    {
        "username": "Louis",
        "password": b"password123",
        "admin": True  # One admin user
    }
]

created_users = []
for user in user_data:
    # Hash password with bcrypt
    user["password"] = bcrypt.hashpw(user["password"], bcrypt.gensalt())
    user["created_at"] = datetime.now()
    
    result = users.insert_one(user)
    created_users.append({
        'user_id': result.inserted_id,
        'username': user['username'],
        'admin': user['admin']
    })

#Create Trades with sub-documents (tags)

SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "XAUUSD", "BTCUSD", "USDCAD", "NZDUSD"]
TYPES = ["buy", "sell"]
STRATEGIES = ["Trend Following", "Breakout", "Range Trading", "Scalping", "Swing Trading"]
ENTRY_TYPES = ["Market Order", "Limit Order", "Stop Order", "Breakout Entry", "Pullback Entry"]
EMOTIONS = ["Confident", "Anxious", "Calm", "Excited", "Disciplined", "Patient"]

all_trades = []  # Collect all trades for trades.json

for user_info in created_users:
    user_id = str(user_info['user_id'])
    username = user_info['username']
    
    # Create 50-100 trades per user
    num_trades = random.randint(50, 100)
    
    for i in range(num_trades):
        # Random dates in past year
        days_ago = random.randint(0, 365)
        open_time = datetime.now() - timedelta(days=days_ago, hours=random.randint(0, 23))
        close_time = open_time + timedelta(hours=random.randint(1, 72))
        symbol = random.choice(SYMBOLS)
        trade_type = random.choice(TYPES)
        lots = random.choice([0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0])
        
        # Realistic pricing
        if symbol == "BTCUSD":
            open_price = round(random.uniform(30000, 120000), 2)
        elif symbol == "XAUUSD":
            open_price = round(random.uniform(1700, 4300), 2)
        elif symbol == "USDJPY":
            open_price = round(random.uniform(100, 150), 3)
        elif symbol == "EURUSD":
            open_price = round(random.uniform(0.95, 1.2), 5)
        elif symbol == "GBPUSD":
            open_price = round(random.uniform(1.0, 1.4), 5)
        elif symbol == "AUDUSD":
            open_price = round(random.uniform(0.55, 1.1), 5)
        elif symbol == "USDCAD":
            open_price = round(random.uniform(1.2, 1.5), 5)
        elif symbol == "NZDUSD":   
            open_price = round(random.uniform(0.55, 0.9), 5)
        
        # 60% win rate
        is_winner = random.random() < 0.6
        
        if is_winner:
            profit = round(random.uniform(10, 300), 2)
            price_change = random.uniform(0.001, 0.02)
        else:
            profit = round(random.uniform(-150, -10), 2)
            price_change = random.uniform(-0.02, -0.001)
        
        if trade_type == "buy":
            close_price = round(open_price * (1 + price_change), 5)
        else:
            close_price = round(open_price * (1 - price_change), 5)
        
        # Sub-documents (tags)
        tags = []
        num_tags = random.randint(1, 3)
        for _ in range(num_tags):
            tag = {
                "_id": ObjectId(),
                "strategy": random.choice(STRATEGIES),
                "entry_type": random.choice(ENTRY_TYPES),
                "emotional_state": random.choice(EMOTIONS),
                "notes": f"Trade note {random.randint(1, 100)}",
                "created_at": open_time.strftime("%Y.%m.%d %H:%M:%S")
            }
            tags.append(tag)
        
        # Trade document with all fields
        trade = {
            "user_id": user_id,  # User isolation
            "ticket": str(random.randint(5000000000, 6000000000)),
            "symbol": symbol,
            "type": trade_type,
            "lots": lots,
            "open_time": open_time.strftime("%Y.%m.%d %H:%M:%S"),
            "close_time": close_time.strftime("%Y.%m.%d %H:%M:%S"),
            "open_price": open_price,
            "close_price": close_price,
            "commission": round(random.uniform(-5.0, -0.5) * lots, 2),
            "swap": round(random.uniform(-2.0, 1.0), 2),
            "profit": profit,
            "sl": round(open_price * (1 - 0.02), 5),
            "tp": round(open_price * (1 + 0.03), 5),
            "tags": tags,
            "created_at": open_time
        }
        
        trades.insert_one(trade)
        all_trades.append(trade)  # Add to collection for JSON export
    

# Export all trades to JSON file
trades_for_json = []

for trade in all_trades:
    # Convert ObjectId to string for JSON serialization
    trade_copy = trade.copy()
    trade_copy['_id'] = str(trade_copy.get('_id', ''))
    
    # Convert tag ObjectIds to strings
    if 'tags' in trade_copy:
        for tag in trade_copy['tags']:
            if '_id' in tag and isinstance(tag['_id'], ObjectId):
                tag['_id'] = str(tag['_id'])
    
    # Convert datetime to string if present
    if 'created_at' in trade_copy and isinstance(trade_copy['created_at'], datetime):
        trade_copy['created_at'] = trade_copy['created_at'].strftime("%Y.%m.%d %H:%M:%S")
    
    trades_for_json.append(trade_copy)

# Write to JSON file
with open('trades.json', 'w') as f:
    json.dump(trades_for_json, f, indent=2)



