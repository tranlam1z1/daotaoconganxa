-- Gán quyền cho CSDL/user "qdpl" trên cụm db-postgresql-sgp1-06837 (DigitalOcean).
-- PHẢI chạy bằng doadmin, khi đang kết nối vào database "qdpl".
ALTER SCHEMA public OWNER TO "qdpl";
GRANT CONNECT, TEMP ON DATABASE "qdpl" TO "qdpl";
GRANT CONNECT, TEMP ON DATABASE "qdpl" TO "doadmin";
REVOKE CONNECT, TEMP ON DATABASE "qdpl" FROM PUBLIC;

GRANT CREATE ON DATABASE "qdpl" TO "qdpl";
GRANT USAGE, CREATE ON SCHEMA public TO "qdpl";
