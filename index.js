import express from "express";
import session from "express-session";
import { pool } from "./db.js";

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Sesión
app.use(
  session({
    secret: "vestuario123",
    resave: false,
    saveUninitialized: false,
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

  const query = await pool.query("SELECT * FROM usuarios WHERE usuario = $1", [
    Usuario,
  ]);

  if (query.rowCount === 0)
    return res.render("index", { error: "Usuario incorrecto" });

  const usuarioDB = query.rows[0];

  if (pass !== usuarioDB.password)
    return res.render("index", { error: "Contraseña incorrecta" });

  req.session.user = usuarioDB.usuario;
  res.redirect("/menu");
});

// MENU
app.get("/menu", isLogged, (req, res) => {
  res.render("menu");
});

// BAILARINES
app.get("/bailarines", isLogged, async (req, res) => {
  const q = await pool.query("SELECT * FROM bailarines ORDER BY id DESC");
  res.render("bailarines", { lista: q.rows });
});

app.post("/bailarines", isLogged, async (req, res) => {
  const { nombre, telefono } = req.body;

  await pool.query("INSERT INTO bailarines(nombre, telefono) VALUES($1, $2)", [
    nombre,
    telefono,
  ]);

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
    inventario: inventario.rows,
  });
});

app.post("/entregar", isLogged, async (req, res) => {
  const { bailarin, vestuario, cantidad } = req.body;

  // Obtener cantidad disponible en inventario
  const inv = await pool.query(
    "SELECT cantidad FROM inventario WHERE id = $1",
    [vestuario]
  );

  if (inv.rowCount === 0) {
    return res.send(`
      <script>
        alert("Error: prenda no encontrada.");
        window.history.back();
      </script>
    `);
  }

  const disponible = inv.rows[0].cantidad;

  // Si no alcanza → mostrar alert
  if (cantidad > disponible) {
    return res.send(`
      <script>
        alert("No hay suficientes prendas disponibles. Disponibles: ${disponible}");
        window.history.back();
      </script>
    `);
  }

  // Registrar entrega
  await pool.query(
    "INSERT INTO entregas(id_bailarin, id_inventario, cantidad) VALUES($1,$2,$3)",
    [bailarin, vestuario, cantidad]
  );

  // Restar del inventario
  await pool.query(
    "UPDATE inventario SET cantidad = cantidad - $1 WHERE id = $2",
    [cantidad, vestuario]
  );

  res.redirect("/entrega");
});


// DEVOLUCIÓN
app.get("/devolucion", isLogged, async (req, res) => {
  const entregas = await pool.query(`
    SELECT e.id, e.cantidad, b.nombre AS bailarin, i.nombre AS prenda
    FROM entregas e
    JOIN bailarines b ON b.id = e.id_bailarin
    JOIN inventario i ON i.id = e.id_inventario
    WHERE e.devuelto = false
  `);

  res.render("devolucion", { entregas: entregas.rows });
});

app.post("/devolver", isLogged, async (req, res) => {
  const { entrega } = req.body;

  // Buscar la entrega
  const q = await pool.query("SELECT * FROM entregas WHERE id=$1", [entrega]);
  if (q.rowCount === 0) return res.send("Error: entrega inexistente");

  const entregaDB = q.rows[0];

  // Registrar devolución
  await pool.query("INSERT INTO devoluciones(id_entrega) VALUES($1)", [
    entrega,
  ]);

  // Sumar inventario
  await pool.query(
    "UPDATE inventario SET cantidad = cantidad + $1 WHERE id=$2",
    [entregaDB.cantidad, entregaDB.id_inventario]
  );

  // Marcar como devuelta
  await pool.query("UPDATE entregas SET devuelto = true WHERE id = $1", [
    entrega,
  ]);

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
      e.cantidad,
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor corriendo en puerto " + PORT));
