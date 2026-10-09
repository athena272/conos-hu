CREATE TABLE conos.usuarios (
    idusuarios INT auto_increment NOT NULL,
    email varchar(100) NOT NULL,
    password varchar(200) NOT NULL,
    CONSTRAINT idusuarios PRIMARY KEY (idusuarios)
) ENGINE = InnoDB DEFAULT CHARSET = latin1 COLLATE = latin1_swedish_ci;