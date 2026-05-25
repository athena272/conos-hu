// Inicializa replica set de um nó (necessário para withTransaction no dev local).
try {
  const status = rs.status();
  if (status.ok === 1) {
    print("Replica set já inicializado.");
    quit(0);
  }
} catch (_) {
  /* not initiated yet */
}

const ok = rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "127.0.0.1:27017" }],
});

if (!ok) {
  print("Falha ao iniciar replica set.");
  quit(1);
}
print("Replica set rs0 inicializado (127.0.0.1:27017).");
