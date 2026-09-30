BEGIN TRANSACTION;

CREATE TABLE "User" ("id" text PRIMARY KEY, "name" text NOT NULL, "email" text NOT NULL UNIQUE, "password" text NOT NULL, "createdAt" text NOT NULL DEFAULT '2025-06-17T15:45:02.876Z', "rol" text NOT NULL REFERENCES "Role" ("id"));

CREATE TABLE "Role" ("id" text PRIMARY KEY, "name" text NOT NULL);

CREATE TABLE "Product" ("id" text PRIMARY KEY, "name" text NOT NULL, "price" integer NOT NULL, "description" text NOT NULL, "category" text NOT NULL, "slug" text NOT NULL UNIQUE, "type" text NOT NULL, "stock" integer NOT NULL, "user" text NOT NULL REFERENCES "User" ("id"));

CREATE TABLE "ProductImage" ("id" text PRIMARY KEY, "productId" text NOT NULL REFERENCES "Product" ("id"), "image" text NOT NULL);

INSERT INTO "User" ("id", "name", "email", "password", "createdAt", "rol") VALUES ('ABC-123-YURE', 'Yureny Pinedo', 'yurepinedop@gmail.com', '$2b$10$dpyDN2yKeBe7PLqvllJlsegkjzdWyN8FGdwVGZ7r926D31R2CQDAW', '2025-06-17T15:45:02.876Z', 'admin');
INSERT INTO "User" ("id", "name", "email", "password", "createdAt", "rol") VALUES ('ABC-123-ITZEL', 'Itzel Pinedo', 'itzelpinedop@gmail.com', '$2b$10$bDSXqIzaevvrAIdREtVb2OuYHDstf7ifrbSDy8o/BJAkAdioBnQnW', '2025-06-17T15:45:02.876Z', 'user');

INSERT INTO "Role" ("id", "name") VALUES ('admin', 'Administrator');
INSERT INTO "Role" ("id", "name") VALUES ('worker', 'Worker');
INSERT INTO "Role" ("id", "name") VALUES ('user', 'client');

INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('a5e7b7dd-74d2-4132-a474-f5c4d805464b', 'Arracada piedras 10mm (pieza)', 380, 'Elegante arracada piedras 10mm (pieza) que realza tu estilo con sofisticación y calidad excepcional.', 'Titanio', 'arracada_piedras_10mm_pieza', 'Broqueles', 7, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('548866a6-2304-4952-a669-2c9d608ed8e5', 'Arracada piedras 8mm (pieza)', 360, 'Elegante arracada piedras 8mm (pieza) que realza tu estilo con sofisticación y calidad excepcional.', 'Titanio', 'arracada_piedras_8mm_pieza', 'Broqueles', 4, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('00cd5bb1-5891-4831-816e-2a8530a39c96', 'Espada gota (pieza)', 360, 'Elegante espada gota (pieza) que realza tu estilo con sofisticación y calidad excepcional.', 'Titanio', 'espada_gota_pieza', 'Broqueles', 0, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('bfd6070d-58dc-48d9-8064-b17fcac57c39', 'Arracadas diamantadas #6 (par)', 100, 'Elegante arracadas diamantadas #6 (par) que realza tu estilo con sofisticación y calidad excepcional.', 'Chapa de Oro 14K', 'arracadas_diamantadas_6_par', 'Broqueles', 1, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('7dec42d7-4ca8-4ebe-a4d7-5e34accad3ec', 'Arracadas diamantadas #2.5 (par)', 70, 'Elegante arracadas diamantadas #2.5 (par) que realza tu estilo con sofisticación y calidad excepcional.', 'Chapa de Oro 14K', 'arracadas_diamantadas_2_5_par', 'Broqueles', 1, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('f7a7aaf5-a306-438a-8f78-afd641f09694', 'Recto estrella #4 (par)', 120, 'Elegante recto estrella #4 (par) que realza tu estilo con sofisticación y calidad excepcional.', 'Chapa de Oro 14K', 'recto_estrella_4_par', 'Broqueles', 1, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('665ec64c-9c20-40b2-9f00-338baedb182c', 'Recto corazón #5 (par)', 130, 'Elegante recto corazón #5 (par) que realza tu estilo con sofisticación y calidad excepcional.', 'Chapa de Oro 14K', 'recto_corazon_5_par', 'Broqueles', 1, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('183a97da-91d9-41c8-921f-54d0144beb02', 'Bisel redondo #5 (par)', 130, 'Elegante bisel redondo #5 (par) que realza tu estilo con sofisticación y calidad excepcional.', 'Chapa de Oro 14K', 'bisel_redondo_5_par', 'Broqueles', 1, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('3928398b-dfb2-44be-8ef1-6b04e4e4002f', 'Arracada penacho 10mm (pieza)', 550, 'Elegante arracada penacho 10mm (pieza) que realza tu estilo con sofisticación y calidad excepcional.', 'Titanio', 'arracada_penacho_10mm_pieza', 'Broqueles', 0, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('7b4b9c6c-6b9b-4376-8edc-0337e5edde88', 'Piedra lágrima #7.5 (par)', 130, 'Elegante piedra lágrima #7.5 (par) que realza tu estilo con sofisticación y calidad excepcional.', 'Chapa de Oro 14K', 'piedra_lagrima_7_5_par', 'Broqueles', 1, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('70d7a096-cbd1-40fe-9fac-6cb4d9d2e6c8', 'Piercing arracada nostril delgada (pieza)', 80, 'Elegante piercing arracada nostril delgada (pieza) que realza tu estilo con sofisticación y calidad excepcional.', 'Acero Quirúrgico', 'piercing_arracada_nostril_delgada_pieza', 'Broqueles', 32, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('e4ea1825-541c-4756-8df6-5417e2d66896', 'VC Negro (par)', 150, 'Elegante vc negro (par) que realza tu estilo con sofisticación y calidad excepcional.', 'Chapa de Oro 14K', 'vc_negro_par', 'Broqueles', 0, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('20d86235-39fc-4888-83fe-7ea9b0d69465', 'Piercing arracada con dije (pieza)', 150, 'Elegante piercing arracada con dije (pieza) que realza tu estilo con sofisticación y calidad excepcional.', 'Acero Quirúrgico', 'piercing_arracada_con_dije_pieza', 'Broqueles', 1, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('6f5b8d29-7d63-4c42-bb30-70631f145231', 'Piercing septum (pieza)', 100, 'Elegante piercing septum (pieza) que realza tu estilo con sofisticación y calidad excepcional.', 'Acero Quirúrgico', 'piercing_septum_pieza', 'Broqueles', 17, 'ABC-123-YURE');
INSERT INTO "Product" ("id", "name", "price", "description", "category", "slug", "type", "stock", "user") VALUES ('cdbb2517-493c-48d8-87da-0897dacf20d8', 'Broquel perron', 100, 'Elegante arete que realza tu estilo con sofisticación y calidad excepcional.', 'Titanio', 'nuevo-producto', 'Broqueles', 1, 'ABC-123-YURE');

INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('8c631f6b-46af-492d-9967-6dc3fe2db844', 'a5e7b7dd-74d2-4132-a474-f5c4d805464b', 'product676.jpg');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('3f3587e5-c3b2-47e3-831a-74f754f6afd3', 'a5e7b7dd-74d2-4132-a474-f5c4d805464b', 'product676hover.jpg');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('f3c19ea9-d387-4269-a120-666e4320d1f1', '548866a6-2304-4952-a669-2c9d608ed8e5', 'product676.jpg');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('e623d6ae-22dc-4c05-ba59-fc391f5e44da', '548866a6-2304-4952-a669-2c9d608ed8e5', 'product676hover.jpg');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('cb8c2658-86ab-4152-b5b1-a558f22e23cd', '00cd5bb1-5891-4831-816e-2a8530a39c96', 'product798.jpg');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('87a4ddcd-2c62-4264-bf01-511107e0c622', '00cd5bb1-5891-4831-816e-2a8530a39c96', 'product798hover.jpg');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('dac8f1f2-e278-43b1-99a7-002ece1225e4', 'bfd6070d-58dc-48d9-8064-b17fcac57c39', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('1532d8e3-a57e-4c70-8348-b14dbf0c160f', 'bfd6070d-58dc-48d9-8064-b17fcac57c39', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('2d0b0072-9c39-446a-9c8b-47bca1047ee6', '7dec42d7-4ca8-4ebe-a4d7-5e34accad3ec', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('9c64ca5a-4c60-4207-ba7a-c62aae6044ad', '7dec42d7-4ca8-4ebe-a4d7-5e34accad3ec', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('d6fb74e2-775b-482b-afd2-da32c9ecd741', 'f7a7aaf5-a306-438a-8f78-afd641f09694', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('238ab889-a288-4e2b-892b-b289f6a224f6', 'f7a7aaf5-a306-438a-8f78-afd641f09694', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('c09d306d-a6f5-4be8-a91c-a724af0f14cc', '665ec64c-9c20-40b2-9f00-338baedb182c', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('0d47f6b8-b0fb-46b4-8999-28b46df4889d', '665ec64c-9c20-40b2-9f00-338baedb182c', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('902a9ece-6082-47c5-a8f3-f6b9294c6ec4', '183a97da-91d9-41c8-921f-54d0144beb02', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('5ac6e815-13dc-4202-8561-e579f6ef9c2f', '183a97da-91d9-41c8-921f-54d0144beb02', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('255c3128-3574-440e-bd40-9b3d4f8be759', '3928398b-dfb2-44be-8ef1-6b04e4e4002f', 'product549.jpg');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('ba0d34ec-428b-41bd-b2ad-b880133785db', '3928398b-dfb2-44be-8ef1-6b04e4e4002f', 'product549hover.jpg');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('59266702-6eb3-43ca-ab19-c148263c2c5e', '7b4b9c6c-6b9b-4376-8edc-0337e5edde88', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('3a86053a-50b4-4714-974f-95b365428053', '7b4b9c6c-6b9b-4376-8edc-0337e5edde88', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('ff6341fe-72cc-4e2c-b4ba-87116263e5f9', '70d7a096-cbd1-40fe-9fac-6cb4d9d2e6c8', 'product558.jpg');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('8ead1b51-2ee9-4ede-9d73-7adbb5bbb40a', '70d7a096-cbd1-40fe-9fac-6cb4d9d2e6c8', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('2b9e562b-4696-4a62-8e7b-c9fcc4fbd7d0', 'e4ea1825-541c-4756-8df6-5417e2d66896', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('55d0618a-a343-4ff2-b20f-5cbaa4393984', 'e4ea1825-541c-4756-8df6-5417e2d66896', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('4971b0ac-468e-4fe6-9ae8-a1d1f255e642', '20d86235-39fc-4888-83fe-7ea9b0d69465', 'product559.jpg');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('93df97c7-efc4-42b0-ab9e-89f25dc1f008', '20d86235-39fc-4888-83fe-7ea9b0d69465', 'logo-blanco.png');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('535f637b-b44f-4dc0-b8d0-2dde1dbca8c2', '6f5b8d29-7d63-4c42-bb30-70631f145231', 'product562.jpg');
INSERT INTO "ProductImage" ("id", "productId", "image") VALUES ('4b381efd-3735-4d3c-877e-8129f4fca97d', '6f5b8d29-7d63-4c42-bb30-70631f145231', 'logo-blanco.png');

COMMIT;