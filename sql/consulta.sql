CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  usuario VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(200) NOT NULL
);

CREATE TABLE bailarines (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100),
  telefono VARCHAR(20)
);

CREATE TABLE inventario (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100),
  categoria VARCHAR(50),
  talla VARCHAR(20),
  cantidad INT
);

CREATE TABLE entregas (
  id SERIAL PRIMARY KEY,
  id_bailarin INT REFERENCES bailarines(id),
  id_inventario INT REFERENCES inventario(id),
  cantidad INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE devoluciones (
  id SERIAL PRIMARY KEY,
  id_entrega INT REFERENCES entregas(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Crear usuario admin
INSERT INTO usuarios(usuario, password)
VALUES ('admin', '$2b$10$J8E14nS6UreRELixIceMGeVUuB9G7sdasyUAW6UIw4NE6jUuYROuG'); 
-- contraseña: 1234
