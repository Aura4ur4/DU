
-- Database Setup for Document Upload System
-- File: setup.sql

-- Create database
CREATE DATABASE IF NOT EXISTS document_uploads;
USE document_uploads;

-- Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sail_p_no VARCHAR(100),
    aadhar_card_path VARCHAR(500) NOT NULL,
    pan_card_path VARCHAR(500) NOT NULL,
    bank_passbook_path VARCHAR(500) NOT NULL,
    passport_photo_path VARCHAR(500) NOT NULL,
    submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    email VARCHAR(255),
    ip_address VARCHAR(45),
    status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_sail_p_no (sail_p_no),
    INDEX idx_submission_date (submission_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create audit log table for tracking changes
CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by VARCHAR(255),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    INDEX idx_submission_id (submission_id),
    INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create users table for admin access (optional)
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role ENUM('admin', 'viewer') DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user (password: admin123 - CHANGE THIS!)
-- Password hash for 'admin123' using bcrypt
INSERT INTO admin_users (username, password_hash, email, full_name, role) 
VALUES ('admin', '$2b$10$rBV2V7hHQOqF.KqWPXN8qO.Qv7jZZ2N8Hf2ql5HZ5yN7nF9yNF9yN', 'admin@example.com', 'System Administrator', 'admin');

-- Create view for easy data retrieval
CREATE OR REPLACE VIEW submissions_summary AS
SELECT 
    s.id,
    s.name,
    s.sail_p_no,
    s.submission_date,
    s.status,
    s.email,
    COUNT(a.id) as audit_count
FROM submissions s
LEFT JOIN audit_log a ON s.id = a.submission_id
GROUP BY s.id
ORDER BY s.submission_date DESC;

-- Stored procedure to get submission details
DELIMITER //

CREATE PROCEDURE GetSubmissionDetails(IN submission_id INT)
BEGIN
    SELECT * FROM submissions WHERE id = submission_id;
    SELECT * FROM audit_log WHERE submission_id = submission_id ORDER BY changed_at DESC;
END //

-- Stored procedure to search submissions
CREATE PROCEDURE SearchSubmissions(
    IN search_name VARCHAR(255),
    IN search_sail_no VARCHAR(100),
    IN search_status VARCHAR(20),
    IN from_date DATE,
    IN to_date DATE
)
BEGIN
    SELECT * FROM submissions
    WHERE 
        (search_name IS NULL OR name LIKE CONCAT('%', search_name, '%'))
        AND (search_sail_no IS NULL OR sail_p_no LIKE CONCAT('%', search_sail_no, '%'))
        AND (search_status IS NULL OR status = search_status)
        AND (from_date IS NULL OR DATE(submission_date) >= from_date)
        AND (to_date IS NULL OR DATE(submission_date) <= to_date)
    ORDER BY submission_date DESC;
END //

-- Stored procedure to update submission status
CREATE PROCEDURE UpdateSubmissionStatus(
    IN submission_id INT,
    IN new_status VARCHAR(20),
    IN admin_user VARCHAR(255),
    IN status_notes TEXT
)
BEGIN
    DECLARE old_status VARCHAR(20);
    
    -- Get old status
    SELECT status INTO old_status FROM submissions WHERE id = submission_id;
    
    -- Update status
    UPDATE submissions 
    SET status = new_status, notes = status_notes
    WHERE id = submission_id;
    
    -- Log the change
    INSERT INTO audit_log (submission_id, action, old_value, new_value, changed_by)
    VALUES (submission_id, 'status_change', old_status, new_status, admin_user);
END //

DELIMITER ;

-- Create trigger to log all updates
DELIMITER //

CREATE TRIGGER before_submission_update
BEFORE UPDATE ON submissions
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO audit_log (submission_id, action, old_value, new_value, changed_by)
        VALUES (NEW.id, 'auto_status_change', OLD.status, NEW.status, 'system');
    END IF;
END //

DELIMITER ;

-- Grant permissions (adjust as needed)
-- CREATE USER 'doc_upload_user'@'localhost' IDENTIFIED BY 'your_secure_password';
-- GRANT SELECT, INSERT, UPDATE ON document_uploads.* TO 'doc_upload_user'@'localhost';
-- FLUSH PRIVILEGES;

-- Sample queries for testing

-- Get all submissions
-- SELECT * FROM submissions ORDER BY submission_date DESC;

-- Get submissions by status
-- SELECT * FROM submissions WHERE status = 'pending';

-- Search by name
-- SELECT * FROM submissions WHERE name LIKE '%John%';

-- Get submission count by status
-- SELECT status, COUNT(*) as count FROM submissions GROUP BY status;

-- Get recent submissions (last 7 days)
-- SELECT * FROM submissions WHERE submission_date >= DATE_SUB(NOW(), INTERVAL 7 DAY);

-- Get submissions with their audit trail
-- SELECT s.*, COUNT(a.id) as audit_count
-- FROM submissions s
-- LEFT JOIN audit_log a ON s.id = a.submission_id
-- GROUP BY s.id;

COMMIT;