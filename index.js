import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";   // ← corregido
import { pool } from "./db.js";

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: "vestuario123",
    resave: false,
    saveUninitialized: false
  })
);

// Middleware para rutas protegidas
function isLogged(req, res, next) {
  if (!req.session.user) return res.redirect("/");
  next();
}

// LOGIN
app.get("/", (req, res) => {
  res.render("index", { error: null });
});

app.post("/login-procesar", async (req, res) => {
  const { Usuario, pass } = req.body;

  const query = await pool.query(
    "SELECT * FROM usuarios WHERE usuario = $1",
    [Usuario]
  );

  if (query.rowCount === 0)
    return res.render("index", { error: "Usuario incorrecto" });

  const usuarioDB = query.rows[0];

  // Comparar contraseña con bcryptjs
  const claveCorrecta = await bcrypt.compare(pass, usuarioDB.pass);

  if (!claveCorrecta)
    return res.render("index", { error: "Contraseña incorrecta" });

  req.session.user = usuarioDB.usuario;
  res.redirect("/menu");
});

// MENU
app.get("/menu", isLogged, (req, res) => {
  res.render("menu");
});

// LISTADO DE BAILARINES
app.get("/bailarines", isLogged, async (req, res) => {
  const q = await pool.query("SELECT * FROM bailarines ORDER BY id DESC");
  res.render("bailarines", { lista: q.rows });
});

app.post("/bailarines", isLogged, async (req, res) => {
  const { nombre, telefono } = req.body;

  await pool.query(
    "INSERT INTO bailarines(nombre, telefono) VALUES($1, $2)",
    [nombre, telefono]
  );

  res.redirect("/bailarines");
});

// VESTUARIO
app.get("/vestuario", isLogged, async (req, res) => {
  const q = await pool.query("SELECT * FROM inventario ORDER BY id DESC");
  res.render("vestuario", { lista: q.rows });
});

app.post("/guardar-vestuario", isLogged, async (req, res) => {
  const { nombre, categoria, talla, cantidad } = req.body;

  await pool.query(
    "INSERT INTO inventario(nombre, categoria, talla, cantidad) VALUES($1, $2, $3, $4)",
    [nombre, categoria, talla, cantidad]
  );

  res.redirect("/vestuario");
});

// ENTREGA
app.get("/entrega", isLogged, async (req, res) => {
  const bailarines = await pool.query("SELECT * FROM bailarines");
  const inventario = await pool.query("SELECT * FROM inventario");
  res.render("entrega", {
    bailarines: bailarines.rows,
    inventario: inventario.rows
  });
});

app.post("/entregar", isLogged, async (req, res) => {
  const { bailarin, vestuario, cantidad } = req.body;
  await pool.query(
    "INSERT INTO entregas(id_bailarin, id_inventario, cantidad) VALUES($1,$2,$3)",
    [bailarin, vestuario, cantidad]
  );
  res.redirect("/entrega");
});

// DEVOLUCIÓN
app.get("/devolucion", isLogged, async (req, res) => {
  const entregas = await pool.query(`
    SELECT e.id, b.nombre AS bailarin, i.nombre AS prenda
    FROM entregas e
    JOIN bailarines b ON b.id=e.id_bailarin
    JOIN inventario i ON i.id=e.id_inventario
  `);

  res.render("devolucion", { entregas: entregas.rows });
});

app.post("/devolver", isLogged, async (req, res) => {
  const { entrega } = req.body;
  await pool.query("INSERT INTO devoluciones(id_entrega) VALUES($1)", [entrega]);
  res.redirect("/devolucion");
});

// HISTORIAL
app.get("/historial", isLogged, async (req, res) => {
  const q = await pool.query(`
    SELECT 
      e.cantidad,
      e.created_at AS fecha,
      b.nombre AS bailarin,
      i.nombre AS vestuario,
      'Entrega' AS tipo
    FROM entregas e
    JOIN bailarines b ON b.id=e.id_bailarin
    JOIN inventario i ON i.id=e.id_inventario

    UNION ALL

    SELECT 
      1 AS cantidad,
      d.created_at AS fecha,
      b.nombre AS bailarin,
      i.nombre AS vestuario,
      'Devolución' AS tipo
    FROM devoluciones d
    JOIN entregas e ON e.id=d.id_entrega
    JOIN bailarines b ON b.id=e.id_bailarin
    JOIN inventario i ON i.id=e.id_inventario

    ORDER BY fecha DESC
  `);

  res.render("historial", { lista: q.rows });
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// PUERTO
app.listen(process.env.PORT || 3000, () =>
  console.log("Servidor corriendo en puerto 3000")
);
