DROP DATABASE IF EXISTS SmartFoodDB;
CREATE DATABASE SmartFoodDB;
USE SmartFoodDB;

CREATE TABLE Donor (
  Donor_ID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(120) NOT NULL,
  Type VARCHAR(40) NOT NULL DEFAULT 'Individual',
  Pincode VARCHAR(10) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE Waiver (
  Waiver_ID INT AUTO_INCREMENT PRIMARY KEY,
  Signed_Date DATE NOT NULL,
  Donor_ID INT NOT NULL,
  CONSTRAINT fk_waiver_donor
    FOREIGN KEY (Donor_ID) REFERENCES Donor(Donor_ID)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Volunteer (
  Vol_ID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(120) NOT NULL,
  License_No VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE Driver (
  Vol_ID INT PRIMARY KEY,
  Vehicle_Type VARCHAR(60) NOT NULL,
  CONSTRAINT fk_driver_volunteer
    FOREIGN KEY (Vol_ID) REFERENCES Volunteer(Vol_ID)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Inspector (
  Vol_ID INT PRIMARY KEY,
  Certification VARCHAR(100) NOT NULL,
  CONSTRAINT fk_inspector_volunteer
    FOREIGN KEY (Vol_ID) REFERENCES Volunteer(Vol_ID)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Beneficiary_NGO (
  NGO_ID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(120) NOT NULL,
  Capacity INT NOT NULL,
  Type VARCHAR(60) NOT NULL DEFAULT 'General',
  CONSTRAINT chk_ngo_capacity CHECK (Capacity > 0)
) ENGINE=InnoDB;

CREATE TABLE Food_Inventory (
  FID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(120) NOT NULL,
  Quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  Unit VARCHAR(20) NOT NULL,
  Expiry_Date DATE NOT NULL,
  Category VARCHAR(60) NOT NULL DEFAULT 'Other',
  Condition_Status ENUM('Pending', 'Good', 'Bad') NOT NULL DEFAULT 'Pending',
  Donor_ID INT NOT NULL,
  CONSTRAINT chk_food_quantity CHECK (Quantity >= 0),
  CONSTRAINT fk_food_donor
    FOREIGN KEY (Donor_ID) REFERENCES Donor(Donor_ID)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Inspection_Report (
  Report_ID INT AUTO_INCREMENT PRIMARY KEY,
  Report_Date DATE NOT NULL,
  Quality_Score INT NOT NULL,
  Notes TEXT,
  Ins_ID INT NOT NULL,
  FID INT NOT NULL,
  CONSTRAINT chk_quality_score CHECK (Quality_Score BETWEEN 1 AND 10),
  CONSTRAINT fk_inspection_inspector
    FOREIGN KEY (Ins_ID) REFERENCES Inspector(Vol_ID)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inspection_food
    FOREIGN KEY (FID) REFERENCES Food_Inventory(FID)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Trip (
  Trip_ID INT AUTO_INCREMENT PRIMARY KEY,
  Vehicle_No VARCHAR(20) NOT NULL,
  Start_Time DATETIME NOT NULL,
  Distance DECIMAL(10,2) NOT NULL DEFAULT 0,
  Driver_ID INT NOT NULL,
  FID INT NULL,
  CONSTRAINT chk_trip_distance CHECK (Distance >= 0),
  CONSTRAINT fk_trip_driver
    FOREIGN KEY (Driver_ID) REFERENCES Driver(Vol_ID)
    ON DELETE RESTRICT,
  CONSTRAINT fk_trip_food
    FOREIGN KEY (FID) REFERENCES Food_Inventory(FID)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE Claim (
  Claim_ID INT AUTO_INCREMENT PRIMARY KEY,
  Claim_Date DATE NOT NULL,
  NGO_ID INT NOT NULL,
  FID INT NOT NULL,
  UNIQUE KEY uq_claim_food (FID),
  CONSTRAINT fk_claim_ngo
    FOREIGN KEY (NGO_ID) REFERENCES Beneficiary_NGO(NGO_ID)
    ON DELETE CASCADE,
  CONSTRAINT fk_claim_food
    FOREIGN KEY (FID) REFERENCES Food_Inventory(FID)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Compost_Batch (
  Batch_ID INT AUTO_INCREMENT PRIMARY KEY,
  Process_Type VARCHAR(80) NOT NULL,
  Start_Date DATE NOT NULL,
  FID INT NOT NULL,
  UNIQUE KEY uq_compost_food (FID),
  CONSTRAINT fk_compost_food
    FOREIGN KEY (FID) REFERENCES Food_Inventory(FID)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Upcycled_Product (
  Product_ID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(120) NOT NULL,
  Price DECIMAL(10,2) NOT NULL DEFAULT 0,
  Stock INT NOT NULL DEFAULT 0,
  Batch_ID INT NOT NULL,
  CONSTRAINT chk_product_price CHECK (Price >= 0),
  CONSTRAINT chk_product_stock CHECK (Stock >= 0),
  CONSTRAINT fk_product_batch
    FOREIGN KEY (Batch_ID) REFERENCES Compost_Batch(Batch_ID)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Food_Audit_Log (
  Audit_ID INT AUTO_INCREMENT PRIMARY KEY,
  FID INT NOT NULL,
  Action_Type VARCHAR(20) NOT NULL,
  Old_Condition_Status ENUM('Pending', 'Good', 'Bad') NULL,
  New_Condition_Status ENUM('Pending', 'Good', 'Bad') NULL,
  Logged_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_food
    FOREIGN KEY (FID) REFERENCES Food_Inventory(FID)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_food_condition ON Food_Inventory(Condition_Status);
CREATE INDEX idx_food_donor ON Food_Inventory(Donor_ID);
CREATE INDEX idx_inspection_food ON Inspection_Report(FID);
CREATE INDEX idx_trip_driver ON Trip(Driver_ID);
CREATE INDEX idx_claim_ngo ON Claim(NGO_ID);
CREATE INDEX idx_compost_start ON Compost_Batch(Start_Date);
CREATE INDEX idx_product_batch ON Upcycled_Product(Batch_ID);
CREATE INDEX idx_audit_food ON Food_Audit_Log(FID);

DELIMITER $$

CREATE TRIGGER SendToCompost
AFTER UPDATE ON Food_Inventory
FOR EACH ROW
BEGIN
    -- Check if the status literally JUST changed to SPOILED
    IF OLD.status != 'BAD' AND NEW.status = 'BAD' THEN
        
        -- Insert into the compost batch, using our Function to do the math!
        INSERT INTO Compost_Batch (food_id, compost_weight_kg, log_time)
        VALUES (NEW.food_id, GetCompostWeight(NEW.qty_kg), NOW());
        
    END IF;
END $$

CREATE PROCEDURE ProcessExpiredFood()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_id INT;
    
    -- Grab only food that is expired but hasn't been marked spoiled yet
    DECLARE exp_cursor CURSOR FOR 
        SELECT food_id FROM Food_Inventory 
        WHERE expiry_date < CURDATE() AND status != 'SPOILED';
        
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN exp_cursor;
    
    read_loop: LOOP
        FETCH exp_cursor INTO v_id;
        
        IF done = 1 THEN
            LEAVE read_loop;
        END IF;

        -- Update the status. (THIS WAKES UP THE TRIGGER!)
        UPDATE Food_Inventory SET status = 'SPOILED' WHERE food_id = v_id;
        
    END LOOP;
    
    CLOSE exp_cursor;
END $$

DELIMITER ;

INSERT INTO Donor (Name, Type, Pincode) VALUES
  ('Asha Community Kitchen', 'Commercial', '411001'),
  ('FreshMart Superstore', 'Commercial', '411014'),
  ('Green Basket Farm', 'Commercial', '412207'),
  ('Hotel Sunrise', 'Commercial', '411045'),
  ('Priya Sharma', 'Individual', '411038'),
  ('Northside Canteen', 'Commercial', '411021'),
  ('Riverside Orchard', 'Commercial', '412110'),
  ('Bread and Butter Bakery', 'Commercial', '411027'),
  ('Anil Patil', 'Individual', '411052'),
  ('Harvest Foods', 'Commercial', '411028');

INSERT INTO Waiver (Signed_Date, Donor_ID) VALUES
  ('2026-04-01', 1),
  ('2026-04-02', 2),
  ('2026-04-03', 4),
  ('2026-04-04', 6),
  ('2026-04-05', 8);

INSERT INTO Volunteer (Name, License_No) VALUES
  ('Ramesh Kumar', 'DRV-MH12-101'),
  ('Fatima Sheikh', 'DRV-MH12-102'),
  ('Arjun Das', 'DRV-MH12-103'),
  ('Neha Joshi', 'DRV-MH12-104'),
  ('Sanjay More', 'DRV-MH12-105'),
  ('Dr Meena Kulkarni', 'INS-FSSAI-201'),
  ('Kabir Shah', 'INS-FSSAI-202'),
  ('Sonal Patwardhan', 'INS-FSSAI-203'),
  ('Vivek Rao', 'INS-FSSAI-204'),
  ('Pooja Nair', 'INS-FSSAI-205');

INSERT INTO Driver (Vol_ID, Vehicle_Type) VALUES
  (1, 'Van'),
  (2, 'Mini Truck'),
  (3, 'Bike'),
  (4, 'Refrigerated Van'),
  (5, 'Pickup Truck');

INSERT INTO Inspector (Vol_ID, Certification) VALUES
  (6, 'Food Safety Level 1'),
  (7, 'Food Safety Level 2'),
  (8, 'Nutrition Quality Auditor'),
  (9, 'Cold Chain Inspector'),
  (10, 'Shelf Life Assessor');

INSERT INTO Beneficiary_NGO (Name, Capacity, Type) VALUES
  ('Hope Foundation', 300, 'Shelter'),
  ('ChildCare Trust', 180, 'Children'),
  ('Seva Senior Home', 120, 'Senior Care'),
  ('Urban Hunger Network', 500, 'Community Kitchen'),
  ('Women Rise Center', 160, 'Women Support'),
  ('Rainbow Relief', 220, 'Disaster Relief'),
  ('Sunbeam Hostel', 140, 'Education'),
  ('Care4All Mission', 260, 'General'),
  ('Night Aid Collective', 200, 'Homeless Support'),
  ('Village Reach NGO', 350, 'Rural Outreach');

INSERT INTO Food_Inventory (Name, Quantity, Unit, Expiry_Date, Category, Condition_Status, Donor_ID) VALUES
  ('Fresh Apples', 120.00, 'kg', '2026-04-20', 'Produce', 'Good', 1),
  ('Prepared Rice Boxes', 0.00, 'boxes', '2026-04-16', 'Cooked Meals', 'Good', 4),
  ('Milk Packets', 60.00, 'liters', '2026-04-17', 'Dairy', 'Pending', 2),
  ('Bread Loaves', 40.00, 'pcs', '2026-04-15', 'Bakery', 'Bad', 8),
  ('Tomato Crates', 0.00, 'kg', '2026-04-18', 'Produce', 'Good', 3),
  ('Cooked Dal', 35.00, 'liters', '2026-04-16', 'Cooked Meals', 'Pending', 6),
  ('Banana Baskets', 90.00, 'kg', '2026-04-15', 'Produce', 'Bad', 7),
  ('Dry Ration Kits', 0.00, 'kits', '2026-06-30', 'Dry Goods', 'Good', 10),
  ('Leafy Greens', 45.00, 'kg', '2026-04-16', 'Produce', 'Pending', 9),
  ('Bakery Surplus Trays', 30.00, 'trays', '2026-04-15', 'Bakery', 'Bad', 8);

INSERT INTO Inspection_Report (Report_Date, Quality_Score, Notes, Ins_ID, FID) VALUES
  ('2026-04-10', 8, 'Fresh and fit for distribution.', 6, 1),
  ('2026-04-10', 9, 'Packed meals are intact and warm.', 7, 2),
  ('2026-04-11', 6, 'Short shelf life, monitor closely.', 8, 3),
  ('2026-04-11', 3, 'Visible mold growth on several loaves.', 9, 4),
  ('2026-04-12', 7, 'Produce is ripe and usable today.', 10, 5),
  ('2026-04-12', 5, 'Safe but should move quickly.', 6, 6),
  ('2026-04-13', 2, 'Bruised fruit with fermentation smell.', 7, 7),
  ('2026-04-13', 8, 'Ration kits sealed and dry.', 8, 8),
  ('2026-04-14', 6, 'Leafy greens need same-day allocation.', 9, 9),
  ('2026-04-14', 4, 'Bakery trays are stale and not reusable.', 10, 10);

INSERT INTO Trip (Vehicle_No, Start_Time, Distance, Driver_ID, FID) VALUES
  ('MH12AB1201', '2026-04-10 08:30:00', 12.50, 1, 1),
  ('MH12CD2202', '2026-04-10 11:15:00', 18.20, 2, 2),
  ('MH12EF3303', '2026-04-11 07:45:00', 9.80, 4, 3),
  ('MH12GH4404', '2026-04-12 10:00:00', 22.10, 5, 5),
  ('MH12JK5505', '2026-04-13 06:50:00', 14.60, 1, 8);

INSERT INTO Claim (Claim_Date, NGO_ID, FID) VALUES
  ('2026-04-10', 1, 2),
  ('2026-04-12', 4, 5),
  ('2026-04-13', 2, 8);

INSERT INTO Compost_Batch (Process_Type, Start_Date, FID) VALUES
  ('Organic Waste', '2026-04-11', 4),
  ('Anaerobic Digestion', '2026-04-13', 7),
  ('Organic Waste', '2026-04-14', 10);

INSERT INTO Upcycled_Product (Name, Price, Stock, Batch_ID) VALUES
  ('Compost Mix - 2kg', 150.00, 35, 1),
  ('Soil Booster Pellets', 220.00, 18, 2),
  ('Garden Nourish Pack', 180.00, 22, 3);

-- Optional DCL examples. Run manually with an admin account if needed.
-- CREATE USER 'inspector_user'@'localhost' IDENTIFIED BY 'securepass123';
-- CREATE USER 'ngo_user'@'localhost' IDENTIFIED BY 'ngopass456';
-- CREATE USER 'driver_user'@'localhost' IDENTIFIED BY 'driverpass789';
-- GRANT SELECT, UPDATE ON SmartFoodDB.Inspection_Report TO 'inspector_user'@'localhost';
-- GRANT SELECT, INSERT ON SmartFoodDB.Claim TO 'ngo_user'@'localhost';
-- GRANT SELECT, INSERT ON SmartFoodDB.Trip TO 'driver_user'@'localhost';

SELECT 'Donor' AS table_name, COUNT(*) AS row_count FROM Donor
UNION ALL
SELECT 'Waiver', COUNT(*) FROM Waiver
UNION ALL
SELECT 'Volunteer', COUNT(*) FROM Volunteer
UNION ALL
SELECT 'Driver', COUNT(*) FROM Driver
UNION ALL
SELECT 'Inspector', COUNT(*) FROM Inspector
UNION ALL
SELECT 'Food_Inventory', COUNT(*) FROM Food_Inventory
UNION ALL
SELECT 'Inspection_Report', COUNT(*) FROM Inspection_Report
UNION ALL
SELECT 'Trip', COUNT(*) FROM Trip
UNION ALL
SELECT 'Beneficiary_NGO', COUNT(*) FROM Beneficiary_NGO
UNION ALL
SELECT 'Claim', COUNT(*) FROM Claim
UNION ALL
SELECT 'Compost_Batch', COUNT(*) FROM Compost_Batch
UNION ALL
SELECT 'Upcycled_Product', COUNT(*) FROM Upcycled_Product;
