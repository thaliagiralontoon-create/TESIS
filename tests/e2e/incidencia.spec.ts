import { expect,test } from "@playwright/test";

test("registrar, confirmar, resolver y cerrar una incidencia",async({page})=>{
  const userResponse=await page.request.get("/api/usuarios");
  const userData=await userResponse.json();
  expect(userResponse.ok(),JSON.stringify(userData)).toBeTruthy();
  const hardware=userData.categorias.find((category:{nombre:string})=>category.nombre==="Hardware");
  expect(hardware).toBeTruthy();
  const suffix=Date.now();
  const technician=await page.request.post("/api/usuarios",{data:{codigo:`TST-${suffix}`,nombre:"Técnico de prueba",correo:`tech-${suffix}@example.test`,rol:"tecnico",area:"Prueba aislada",especialidadId:hardware.id}});
  expect(technician.ok()).toBeTruthy();

  await page.goto("/incidencias/nueva");
  await page.getByLabel("Título").fill("Prueba E2E cargador");
  await page.getByLabel("Descripción").fill("El cargador no suministra energía correctamente durante la prueba automatizada.");
  await expect(page.getByText(/Hardware/).first()).toBeVisible({timeout:15_000});
  await page.getByRole("button",{name:"Registrar incidencia"}).click();
  await expect(page.getByText(/Incidencia registrada: INC-/)).toBeVisible({timeout:15_000});
  await page.getByRole("link",{name:"Ver incidencia"}).click();
  await expect(page.getByRole("heading",{name:"Prueba E2E cargador"})).toBeVisible();
  await page.getByRole("button",{name:"Confirmar categoría"}).click();
  await expect(page.getByText("Categoría confirmada:")).toBeVisible();
  await page.getByRole("button",{name:"Iniciar atención"}).click();
  await page.getByPlaceholder("Describe la solución aplicada").fill("Se reemplazó el adaptador de prueba.");
  await page.getByRole("button",{name:"Marcar como resuelta"}).click();
  await expect(page.getByRole("button",{name:"Cerrar incidencia"})).toBeVisible();
  await page.getByRole("button",{name:"Cerrar incidencia"}).click();
  await expect(page.getByText("Cerrado",{exact:true}).first()).toBeVisible();
});
