import { redirect } from "next/navigation"

// La aplicación real es estática (HTML/CSS/JS puro) y vive en /public.
// Redirigimos la raíz a index.html para poder previsualizarla.
export default function Page() {
  redirect("/index.html")
}
