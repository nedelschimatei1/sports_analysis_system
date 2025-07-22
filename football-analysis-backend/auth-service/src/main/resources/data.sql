CREATE TABLE IF NOT EXISTS "users" (
   id UUID PRIMARY KEY,
   name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    failedblogins INTEGER DEFAULT 0
    );

-- Insert the user if no existing user with the same id or email exists
INSERT INTO "users" (id, name, email, password)
SELECT '223e5005-e89b-12d3-a456-426614175000','admin', 'testuser@test.com',
       '$2a$12$ro7xU0EurWL4wSt.NYVAr.5NtBWWB3FfxzDq6SpjkL7cnBCt0xVsC'
    WHERE NOT EXISTS (
    SELECT 1
    FROM "users"
    WHERE id = '223e5005-e89b-12d3-a456-426614175000'
       OR email = 'testuser@test.com'
);
