-- 修复 admin_logs.admin_id 外键约束：从 users 表改为 admins 表
-- 先删除旧约束，再添加新约束

ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey;
ALTER TABLE admin_logs ADD CONSTRAINT admin_logs_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE;
