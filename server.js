const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ override: true });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'SmartFoodDB',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Error handling middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// =====================
// DASHBOARD ENDPOINTS
// =====================

app.get('/api/dashboard/stats', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  
  try {
    // Total food items
    const [[totalFood]] = await conn.query(
      'SELECT COUNT(*) as count FROM Food_Inventory'
    );
    
    // Good food count
    const [[goodFood]] = await conn.query(
      'SELECT COUNT(*) as count FROM Food_Inventory WHERE Condition_Status = "Good"'
    );
    
    // Bad food count
    const [[badFood]] = await conn.query(
      'SELECT COUNT(*) as count FROM Food_Inventory WHERE Condition_Status = "Bad"'
    );
    
    // Pending food count
    const [[pendingFood]] = await conn.query(
      'SELECT COUNT(*) as count FROM Food_Inventory WHERE Condition_Status = "Pending"'
    );
    
    // NGOs served (unique NGOs with claims)
    const [[ngosServed]] = await conn.query(
      'SELECT COUNT(DISTINCT NGO_ID) as count FROM Claim'
    );
    
    // Total quantity of good food
    const [[goodQuantity]] = await conn.query(
      'SELECT COALESCE(SUM(Quantity), 0) as total FROM Food_Inventory WHERE Condition_Status = "Good"'
    );
    
    res.json({
      totalFood: totalFood.count,
      goodFood: goodFood.count,
      badFood: badFood.count,
      pendingFood: pendingFood.count,
      ngosServed: ngosServed.count,
      goodQuantity: parseFloat(goodQuantity.total)
    });
  } finally {
    conn.release();
  }
}));

// =====================
// DONOR ENDPOINTS
// =====================

app.get('/api/donors', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [donors] = await conn.query('SELECT * FROM Donor');
    res.json(donors);
  } finally {
    conn.release();
  }
}));

app.post('/api/donors', asyncHandler(async (req, res) => {
  const { name, type, pincode } = req.body;
  
  if (!name || !pincode) {
    return res.status(400).json({ error: 'Name and Pincode are required' });
  }
  
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(
      'INSERT INTO Donor (Name, Type, Pincode) VALUES (?, ?, ?)',
      [name, type || 'Individual', pincode]
    );
    
    res.status(201).json({
      id: result.insertId,
      name,
      type: type || 'Individual',
      pincode
    });
  } finally {
    conn.release();
  }
}));

app.put('/api/donors/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, type, pincode } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.query(
      'UPDATE Donor SET Name = ?, Type = ?, Pincode = ? WHERE Donor_ID = ?',
      [name, type, pincode, id]
    );
    
    res.json({ message: 'Donor updated successfully' });
  } finally {
    conn.release();
  }
}));

app.delete('/api/donors/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  
  try {
    await conn.query('DELETE FROM Donor WHERE Donor_ID = ?', [id]);
    res.json({ message: 'Donor deleted successfully' });
  } finally {
    conn.release();
  }
}));

// =====================
// FOOD INVENTORY ENDPOINTS
// =====================

app.get('/api/food-inventory', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [foods] = await conn.query(`
      SELECT 
        f.*,
        d.Name as Donor_Name,
        d.Type as Donor_Type
      FROM Food_Inventory f
      LEFT JOIN Donor d ON f.Donor_ID = d.Donor_ID
      ORDER BY f.FID DESC
    `);
    res.json(foods);
  } finally {
    conn.release();
  }
}));

app.post('/api/food-inventory', asyncHandler(async (req, res) => {
  const { name, quantity, unit, expiryDate, category, donorId } = req.body;
  
  if (!name || !quantity || !unit || !expiryDate || !donorId) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(
      `INSERT INTO Food_Inventory 
       (Name, Quantity, Unit, Expiry_Date, Category, Condition_Status, Donor_ID) 
       VALUES (?, ?, ?, ?, ?, 'Pending', ?)`,
      [name, quantity, unit, expiryDate, category || 'Other', donorId]
    );
    
    res.status(201).json({
      id: result.insertId,
      name,
      quantity,
      unit,
      expiryDate,
      category: category || 'Other',
      conditionStatus: 'Pending',
      donorId
    });
  } finally {
    conn.release();
  }
}));

app.put('/api/food-inventory/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, quantity, unit, expiryDate, category, conditionStatus } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.query(
      `UPDATE Food_Inventory 
       SET Name = ?, Quantity = ?, Unit = ?, Expiry_Date = ?, Category = ?, Condition_Status = ?
       WHERE FID = ?`,
      [name, quantity, unit, expiryDate, category, conditionStatus, id]
    );
    
    // If condition status changed to "Bad", automatically create compost batch
    if (conditionStatus === 'Bad') {
      const [existing] = await conn.query(
        'SELECT * FROM Compost_Batch WHERE FID = ?',
        [id]
      );
      
      if (existing.length === 0) {
        await conn.query(
          'INSERT INTO Compost_Batch (Process_Type, Start_Date, FID) VALUES (?, ?, ?)',
          ['Organic Waste', new Date().toISOString().split('T')[0], id]
        );
      }
    }
    
    res.json({ message: 'Food inventory updated successfully' });
  } finally {
    conn.release();
  }
}));

app.delete('/api/food-inventory/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  
  try {
    await conn.query('DELETE FROM Food_Inventory WHERE FID = ?', [id]);
    res.json({ message: 'Food item deleted successfully' });
  } finally {
    conn.release();
  }
}));

// =====================
// VOLUNTEER ENDPOINTS
// =====================

app.get('/api/volunteers', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [volunteers] = await conn.query('SELECT * FROM Volunteer');
    res.json(volunteers);
  } finally {
    conn.release();
  }
}));

app.get('/api/drivers', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [drivers] = await conn.query(`
      SELECT v.*, d.Vehicle_Type
      FROM Volunteer v
      JOIN Driver d ON v.Vol_ID = d.Vol_ID
    `);
    res.json(drivers);
  } finally {
    conn.release();
  }
}));

app.get('/api/inspectors', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [inspectors] = await conn.query(`
      SELECT v.*, i.Certification
      FROM Volunteer v
      JOIN Inspector i ON v.Vol_ID = i.Vol_ID
    `);
    res.json(inspectors);
  } finally {
    conn.release();
  }
}));

app.post('/api/volunteers/driver', asyncHandler(async (req, res) => {
  const { name, licenseNo, vehicleType } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const [result] = await conn.query(
      'INSERT INTO Volunteer (Name, License_No) VALUES (?, ?)',
      [name, licenseNo]
    );
    
    await conn.query(
      'INSERT INTO Driver (Vol_ID, Vehicle_Type) VALUES (?, ?)',
      [result.insertId, vehicleType]
    );
    
    await conn.commit();
    
    res.status(201).json({
      id: result.insertId,
      name,
      licenseNo,
      vehicleType
    });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

app.post('/api/volunteers/inspector', asyncHandler(async (req, res) => {
  const { name, licenseNo, certification } = req.body;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const [result] = await conn.query(
      'INSERT INTO Volunteer (Name, License_No) VALUES (?, ?)',
      [name, licenseNo]
    );
    
    await conn.query(
      'INSERT INTO Inspector (Vol_ID, Certification) VALUES (?, ?)',
      [result.insertId, certification]
    );
    
    await conn.commit();
    
    res.status(201).json({
      id: result.insertId,
      name,
      licenseNo,
      certification
    });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

// =====================
// INSPECTION ENDPOINTS
// =====================

app.get('/api/inspections', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [reports] = await conn.query(`
      SELECT 
        ir.*,
        v.Name as Inspector_Name,
        f.Name as Food_Name,
        f.Condition_Status
      FROM Inspection_Report ir
      JOIN Inspector ins ON ir.Ins_ID = ins.Vol_ID
      JOIN Volunteer v ON ins.Vol_ID = v.Vol_ID
      JOIN Food_Inventory f ON ir.FID = f.FID
      ORDER BY ir.Report_Date DESC
    `);
    res.json(reports);
  } finally {
    conn.release();
  }
}));

app.post('/api/inspections', asyncHandler(async (req, res) => {
  const { inspectorId, foodId, qualityScore, notes } = req.body;
  
  if (!inspectorId || !foodId || qualityScore === undefined) {
    return res.status(400).json({ error: 'Required fields missing' });
  }
  
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(
      `INSERT INTO Inspection_Report 
       (Report_Date, Quality_Score, Notes, Ins_ID, FID) 
       VALUES (?, ?, ?, ?, ?)`,
      [new Date().toISOString().split('T')[0], qualityScore, notes || '', inspectorId, foodId]
    );
    
    // Auto-update condition based on quality score
    let condition = 'Pending';
    if (qualityScore >= 7) {
      condition = 'Good';
    } else if (qualityScore < 5) {
      condition = 'Bad';
    }
    
    await conn.query(
      'UPDATE Food_Inventory SET Condition_Status = ? WHERE FID = ?',
      [condition, foodId]
    );
    
    // If bad, create compost batch
    if (condition === 'Bad') {
      const [existing] = await conn.query(
        'SELECT * FROM Compost_Batch WHERE FID = ?',
        [foodId]
      );
      
      if (existing.length === 0) {
        await conn.query(
          'INSERT INTO Compost_Batch (Process_Type, Start_Date, FID) VALUES (?, ?, ?)',
          ['Organic Waste', new Date().toISOString().split('T')[0], foodId]
        );
      }
    }
    
    res.status(201).json({
      id: result.insertId,
      reportDate: new Date().toISOString().split('T')[0],
      qualityScore,
      notes,
      inspectorId,
      foodId,
      condition
    });
  } finally {
    conn.release();
  }
}));

// =====================
// TRIP ENDPOINTS
// =====================

app.get('/api/trips', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [trips] = await conn.query(`
      SELECT 
        t.*,
        v.Name as Driver_Name,
        v.License_No,
        f.Name as Food_Name,
        drv.Vehicle_Type
      FROM Trip t
      JOIN Driver drv ON t.Driver_ID = drv.Vol_ID
      JOIN Volunteer v ON drv.Vol_ID = v.Vol_ID
      LEFT JOIN Food_Inventory f ON t.FID = f.FID
      ORDER BY t.Start_Time DESC
    `);
    res.json(trips);
  } finally {
    conn.release();
  }
}));

app.post('/api/trips', asyncHandler(async (req, res) => {
  const { vehicleNo, startTime, distance, driverId, foodId } = req.body;
  
  if (!vehicleNo || !startTime || !driverId) {
    return res.status(400).json({ error: 'Required fields missing' });
  }
  
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(
      `INSERT INTO Trip (Vehicle_No, Start_Time, Distance, Driver_ID, FID) 
       VALUES (?, ?, ?, ?, ?)`,
      [vehicleNo, startTime, distance || 0, driverId, foodId || null]
    );
    
    res.status(201).json({
      id: result.insertId,
      vehicleNo,
      startTime,
      distance: distance || 0,
      driverId,
      foodId
    });
  } finally {
    conn.release();
  }
}));

// =====================
// NGO ENDPOINTS
// =====================

app.get('/api/ngos', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [ngos] = await conn.query('SELECT * FROM Beneficiary_NGO ORDER BY Name');
    res.json(ngos);
  } finally {
    conn.release();
  }
}));

app.post('/api/ngos', asyncHandler(async (req, res) => {
  const { name, capacity, type } = req.body;
  
  if (!name || !capacity) {
    return res.status(400).json({ error: 'Name and Capacity are required' });
  }
  
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(
      'INSERT INTO Beneficiary_NGO (Name, Capacity, Type) VALUES (?, ?, ?)',
      [name, capacity, type || 'General']
    );
    
    res.status(201).json({
      id: result.insertId,
      name,
      capacity,
      type: type || 'General'
    });
  } finally {
    conn.release();
  }
}));

// =====================
// CLAIM ENDPOINTS
// =====================

app.get('/api/claims', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [claims] = await conn.query(`
      SELECT 
        c.*,
        n.Name as NGO_Name,
        f.Name as Food_Name,
        f.Quantity,
        f.Unit,
        f.Condition_Status
      FROM Claim c
      JOIN Beneficiary_NGO n ON c.NGO_ID = n.NGO_ID
      JOIN Food_Inventory f ON c.FID = f.FID
      ORDER BY c.Claim_Date DESC
    `);
    res.json(claims);
  } finally {
    conn.release();
  }
}));

app.post('/api/claims', asyncHandler(async (req, res) => {
  const { ngoId, foodId } = req.body;
  
  if (!ngoId || !foodId) {
    return res.status(400).json({ error: 'NGO ID and Food ID are required' });
  }
  
  const conn = await pool.getConnection();
  try {
    // Check if food is good and has quantity
    const [[food]] = await conn.query(
      'SELECT * FROM Food_Inventory WHERE FID = ?',
      [foodId]
    );
    
    if (!food) {
      return res.status(404).json({ error: 'Food item not found' });
    }
    
    if (food.Condition_Status !== 'Good') {
      return res.status(400).json({ error: 'Food must be in Good condition to claim' });
    }
    
    if (food.Quantity <= 0) {
      return res.status(400).json({ error: 'Food quantity is zero' });
    }
    
    // Check if already claimed
    const [[existing]] = await conn.query(
      'SELECT * FROM Claim WHERE FID = ?',
      [foodId]
    );
    
    if (existing) {
      return res.status(400).json({ error: 'Food has already been claimed' });
    }
    
    await conn.beginTransaction();
    
    // Create claim
    const [result] = await conn.query(
      'INSERT INTO Claim (Claim_Date, NGO_ID, FID) VALUES (?, ?, ?)',
      [new Date().toISOString().split('T')[0], ngoId, foodId]
    );
    
    // Set quantity to 0 to mark as claimed
    await conn.query(
      'UPDATE Food_Inventory SET Quantity = 0 WHERE FID = ?',
      [foodId]
    );
    
    await conn.commit();
    
    res.status(201).json({
      id: result.insertId,
      ngoId,
      foodId,
      claimDate: new Date().toISOString().split('T')[0],
      message: 'Food claimed successfully'
    });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));

// =====================
// COMPOST ENDPOINTS
// =====================

app.get('/api/compost', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [batches] = await conn.query(`
      SELECT 
        cb.*,
        f.Name as Food_Name,
        f.Quantity,
        f.Unit
      FROM Compost_Batch cb
      JOIN Food_Inventory f ON cb.FID = f.FID
      ORDER BY cb.Start_Date DESC
    `);
    res.json(batches);
  } finally {
    conn.release();
  }
}));

app.post('/api/compost', asyncHandler(async (req, res) => {
  const { foodId, processType } = req.body;
  
  if (!foodId) {
    return res.status(400).json({ error: 'Food ID is required' });
  }
  
  const conn = await pool.getConnection();
  try {
    // Check if already in a batch
    const [[existing]] = await conn.query(
      'SELECT * FROM Compost_Batch WHERE FID = ?',
      [foodId]
    );
    
    if (existing) {
      return res.status(400).json({ error: 'Food is already in a compost batch' });
    }
    
    const [result] = await conn.query(
      'INSERT INTO Compost_Batch (Process_Type, Start_Date, FID) VALUES (?, ?, ?)',
      [processType || 'Organic Waste', new Date().toISOString().split('T')[0], foodId]
    );
    
    res.status(201).json({
      id: result.insertId,
      foodId,
      processType: processType || 'Organic Waste',
      startDate: new Date().toISOString().split('T')[0]
    });
  } finally {
    conn.release();
  }
}));

// =====================
// UPCYCLED PRODUCT ENDPOINTS
// =====================

app.get('/api/upcycled-products', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [products] = await conn.query(`
      SELECT 
        up.*,
        cb.Process_Type,
        cb.Start_Date,
        f.Name as Food_Source
      FROM Upcycled_Product up
      JOIN Compost_Batch cb ON up.Batch_ID = cb.Batch_ID
      JOIN Food_Inventory f ON cb.FID = f.FID
      ORDER BY up.Product_ID DESC
    `);
    res.json(products);
  } finally {
    conn.release();
  }
}));

app.post('/api/upcycled-products', asyncHandler(async (req, res) => {
  const { name, price, stock, batchId } = req.body;
  
  if (!name || !batchId) {
    return res.status(400).json({ error: 'Name and Batch ID are required' });
  }
  
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(
      'INSERT INTO Upcycled_Product (Name, Price, Stock, Batch_ID) VALUES (?, ?, ?, ?)',
      [name, price || 0, stock || 0, batchId]
    );
    
    res.status(201).json({
      id: result.insertId,
      name,
      price: price || 0,
      stock: stock || 0,
      batchId
    });
  } finally {
    conn.release();
  }
}));

// =====================
// WAIVER ENDPOINTS
// =====================

app.get('/api/waivers', asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [waivers] = await conn.query(`
      SELECT 
        w.*,
        d.Name as Donor_Name
      FROM Waiver w
      JOIN Donor d ON w.Donor_ID = d.Donor_ID
      ORDER BY w.Signed_Date DESC
    `);
    res.json(waivers);
  } finally {
    conn.release();
  }
}));

app.post('/api/waivers', asyncHandler(async (req, res) => {
  const { donorId, signedDate } = req.body;
  
  if (!donorId) {
    return res.status(400).json({ error: 'Donor ID is required' });
  }
  
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.query(
      'INSERT INTO Waiver (Signed_Date, Donor_ID) VALUES (?, ?)',
      [signedDate || new Date().toISOString().split('T')[0], donorId]
    );
    
    res.status(201).json({
      id: result.insertId,
      donorId,
      signedDate: signedDate || new Date().toISOString().split('T')[0]
    });
  } finally {
    conn.release();
  }
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Smart Food Redistribution Server running on port ${PORT}`);
});