# 🍃 Smart Food Redistribution & Waste Management System

**A complete, production-ready full-stack solution for managing food donations, reducing waste, and connecting donors with NGOs.**

---

Deployement on Vercel: https://smartfood-redistribution.vercel.app/

## ⚡ Quick Start (5 minutes)

### Prerequisites
- Node.js v14+ and npm
- MySQL v5.7+

### 1. Setup Database
```bash
mysql -u root -p < database.sql
```

### 2. Install & Configure
```bash
npm install
# Edit .env with your MySQL password
```

### 3. Run
```bash
npm start
# Open http://localhost:5000
```

**Done!** 🎉 Access the dashboard and start managing food donations.

---

## 📋 What's Included

✅ **Full Backend** - Express.js with 60+ API endpoints  
✅ **Modern Frontend** - HTML5, CSS3, JavaScript (no framework bloat)  
✅ **Complete Database** - 12 tables with zero circular dependencies  
✅ **Sample Data** - 10 donors, volunteers, NGOs pre-loaded  
✅ **Automatic Logic** - Inspection → Status update → Compost/Claim  
✅ **Transaction Safety** - Prevents double-claims with ACID compliance  

---

## 🎯 Core Workflow

```
1. Donor donates food → Food_Inventory (Pending)
                    ↓
2. Inspector checks quality (score 1-10)
                    ↓
3. Auto-update condition:
   • ≥7 (Good)     → NGO can claim
   • <5 (Bad)      → Auto-create compost batch
   • 5-6 (Pending) → Waiting for re-inspection
                    ↓
4. NGO claims food  OR  Bad food → Compost → Upcycled Products
5. Driver delivers trip
```

---

## 📊 Dashboard Features

| Feature | Details |
|---------|---------|
| **Stats** | Total food, Good/Bad/Pending counts, NGOs served |
| **Donors** | Add, view, delete donors (Individual/Commercial) |
| **Food Inventory** | Core hub - add donations, update condition, track expiry |
| **Inspection** | Assign inspectors, score quality, auto-update status |
| **Logistics** | Create trips, assign drivers, track delivery |
| **NGOs** | Register organizations, claim food with validation |
| **Compost** | Auto-segregate bad food, create batches, track process |
| **Upcycled** | Convert compost to products, manage inventory |

---

## 🗄️ Database Architecture

**Hub-and-Spoke Model** (Zero Circular Dependencies):

```
                          FOOD_INVENTORY
                          (Central Hub)
                               ↑
                    ┌──────────┼──────────┐
                    ↓          ↓          ↓
                 DONOR    INSPECTION    TRIP
                           ↓            ↓
                          BAD      CONDITION_STATUS
                           ↓            ↓
                        COMPOST     CLAIM→NGO
                           ↓
                      UPCYCLED_PRODUCT
```

**13 Tables:**
- Donor, Waiver
- Volunteer (→ Driver, Inspector subclasses)
- Food_Inventory, Inspection_Report, Trip
- Beneficiary_NGO, Claim
- Compost_Batch, Upcycled_Product

---

## 💻 Tech Stack

### Backend
- **Framework**: Express.js (Node.js)
- **Database**: MySQL with mysql2/promise
- **Features**: CORS, Transactions, Prepared Statements
- **Port**: 5000 (configurable)

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern gradients, flexbox, animations
- **JavaScript** - Vanilla (no dependencies needed)
- **Styling**: 300+ lines of custom CSS with 8 color variables

### Database
- **Schema**: Relational design with constraints
- **Security**: User roles, permissions, transactions
- **Indexes**: On all foreign keys and frequently searched columns

---

## 🚀 Installation Steps

### Step 1: Clone/Download
```bash
git clone <repository>
cd smart-food-redistribution
```

### Step 2: MySQL Setup
```bash
# Load database schema and sample data
mysql -u root -p < database.sql

# Verify
mysql -u root -p -e "USE SmartFoodDB; SHOW TABLES;"
```

### Step 3: Node.js Setup
```bash
npm install
```

### Step 4: Configure
Edit `.env`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=SmartFoodDB
PORT=5000
```

### Step 5: Run
```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

### Step 6: Access
Open browser: **http://localhost:5000**

---

## 📡 API Endpoints (Quick Reference)

### Dashboard
- `GET /api/dashboard/stats` - Real-time statistics

### Donors
- `GET /api/donors` - List all
- `POST /api/donors` - Create
- `PUT /api/donors/:id` - Update
- `DELETE /api/donors/:id` - Delete

### Food Inventory
- `GET /api/food-inventory` - List all
- `POST /api/food-inventory` - Create donation
- `PUT /api/food-inventory/:id` - Update (triggers logic)
- `DELETE /api/food-inventory/:id` - Delete

### Inspections
- `GET /api/inspections` - List all reports
- `POST /api/inspections` - Create (auto-updates food condition)

### Trips
- `GET /api/trips` - List all
- `POST /api/trips` - Create trip
- `POST /api/volunteers/driver` - Add driver
- `POST /api/volunteers/inspector` - Add inspector

### NGOs & Claims
- `GET /api/ngos` - List NGOs
- `POST /api/ngos` - Register NGO
- `GET /api/claims` - List claims
- `POST /api/claims` - Claim food (transaction-safe)

### Compost & Recycling
- `GET /api/compost` - List batches
- `POST /api/compost` - Create batch
- `GET /api/upcycled-products` - List products
- `POST /api/upcycled-products` - Add product

---

## 🔄 Automatic Logic

### Inspection to Condition Update
```javascript
if (qualityScore >= 7) condition = 'Good'
else if (qualityScore < 5) {
    condition = 'Bad'
    // Auto-create compost batch
}
else condition = 'Pending'
```

### Claim Safety (Transaction)
```javascript
START TRANSACTION
  1. Verify: Condition = 'Good' && Quantity > 0
  2. Check: Not already claimed
  3. Insert claim record
  4. Set quantity to 0
COMMIT
```

### Food Status Update
When you change condition status to "Bad":
- Auto-creates compost batch if not exists
- Removed from NGO availability
- Ready for recycling/upcycling

---

## 🎨 UI Highlights

- **Modern Design**: Green theme (primary color: #2ecc71)
- **Responsive**: Mobile-friendly layouts
- **Color Coding**: Green (Good), Red (Bad), Yellow (Pending)
- **Animations**: Smooth transitions and alerts
- **Forms**: Real-time validation with clear feedback
- **Tables**: Sortable, responsive data display

---

## 📝 Sample Data Included

### 10 Donors
- Rahul Sharma, Taj Hotel, Priya Desai, Marriott, etc.

### 5 Drivers
- Ramesh Kumar (Van), Suresh Patil (Truck), etc.

### 5 Inspectors
- Dr. Meena (Level 1), Dr. Kapoor (Level 2), etc.

### 10 NGOs
- Hope Foundation (500 capacity, Orphanage)
- Feeding Pune (1000 capacity, Street Distribution)
- etc.

### 10 Food Items
- 4 Good condition
- 3 Bad condition
- 3 Pending inspection

---

## ✅ Verification Checklist

After setup, verify everything works:

1. **Database**
   ```sql
   mysql -u root -p -e "USE SmartFoodDB; SELECT COUNT(*) as Tables FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='SmartFoodDB';"
   ```
   Expected: 13

2. **Backend**
   ```bash
   npm start
   # Look for: "🍃 Smart Food Redistribution Server running on port 5000"
   ```

3. **Frontend**
   - Open http://localhost:5000
   - See dashboard with stats
   - Click "Dashboard" tab

4. **API**
   ```bash
   curl http://localhost:5000/api/dashboard/stats
   ```
   Expected: JSON with totalFood, goodFood, etc.

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| MySQL connection error | Check `.env` password, ensure MySQL is running |
| Port 5000 in use | Kill process: `lsof -i :5000` → `kill -9 <PID>` or change PORT in `.env` |
| Database not found | Run: `mysql -u root -p < database.sql` |
| CORS error | Ensure backend is running and frontend calls correct API_URL |
| 404 on frontend | Verify `public/index.html` exists, hard refresh browser |

---

## 📚 Detailed Documentation

See **SETUP.md** for:
- Complete installation guide with screenshots
- All API endpoints with curl examples
- Database schema explanation
- User roles and permissions
- Troubleshooting guide
- Next steps and examples

---

## 🔐 Security Features

✅ SQL Injection prevention - Prepared statements  
✅ Transaction safety - ACID compliance  
✅ User roles - Different permissions per role  
✅ Unique constraints - Prevent double-claims  
✅ Check constraints - Validate condition status  
✅ Foreign keys - Referential integrity  

---

## 📈 Performance

✅ Query indexes on 8 key columns  
✅ Connection pooling (10 concurrent)  
✅ Efficient joins with proper relationships  
✅ Frontend pagination-ready  
✅ Optimized CSS (no unused styles)  

---

## 🌍 Real-World Use Cases

1. **Hotels** → Donate leftover food
2. **Bakeries** → Redistribute expiring items
3. **Inspectors** → Quality check process
4. **NGOs** → Claim good food for distribution
5. **Drivers** → Manage deliveries
6. **Waste Processors** → Convert bad food to compost
7. **Eco-Entrepreneurs** → Upcycled product creation

---

## 🎓 Learning Value

This project demonstrates:
- **Database Design**: Hub-and-spoke architecture, zero cycles
- **Inheritance Modeling**: Volunteer → Driver/Inspector
- **Transaction Management**: ACID properties with rollback
- **REST API Design**: 60+ endpoints, proper HTTP methods
- **Frontend-Backend Integration**: Fetch API, async/await
- **Form Validation**: Both client and server-side
- **Real-world Automation**: Condition-triggered actions

---

## 📞 Support

For issues:
1. Check SETUP.md troubleshooting section
2. Verify database: `mysql -u root -p < database.sql`
3. Check backend logs: `npm start`
4. Test API: `curl http://localhost:5000/api/dashboard/stats`
5. Review browser console: F12 → Console tab

---

## 📄 License

MIT License - Free for educational and commercial use

---

## 🎉 You're All Set!

Your Smart Food Redistribution System is ready to:
- ✅ Manage food donations
- ✅ Quality check with inspections
- ✅ Distribute to NGOs
- ✅ Process waste into products
- ✅ Track everything in real-time

**Start by adding a donor and donation to see the system in action!**

---

**Version**: 1.0.0  
**Last Updated**: 2026  
**Status**: Production Ready ✅
