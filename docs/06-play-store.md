# 6. Consideraciones para publicación en Google Play Store

Aspectos de **permisos**, **cámara**, **almacenamiento**, **UX** y **políticas** para publicar la app empaquetada con Capacitor en Google Play Store.

---

## 6.1 Permisos (Android)

La app necesita permisos limitados y declarados de forma clara para que la revisión de Play Store y los usuarios confíen.

| Permiso | Uso en la app | Cuándo pedirlo |
|---------|----------------|----------------|
| **Cámara** | Foto obligatoria del marcador final; fotos opcionales por cuarto. | En el momento de “Cerrar partido” (o al abrir la pantalla de cierre), no al instalar. |
| **Almacenamiento / Media** | Guardar fotos en el dispositivo (opcional: “Guardar acta”); en Android 10+ preferir Scoped Storage. | Solo si se ofrece “Guardar acta en galería”; si todo es en app y subida a servidor, puede no ser necesario. |
| **Internet** | Sincronización con el servidor; descarga de equipos/jugadores. | Implícito; no requiere permiso peligroso en Android. |
| **Vibración** (opcional) | Retroalimentación al registrar evento (configurable). | Opcional; no bloquea publicación. |
| **Red / estado de red** | Saber si hay conexión para mostrar “Offline / Pendiente sync / Sincronizado”. | No es permiso peligroso. |

**Recomendación:**  
- Pedir **cámara** solo cuando el usuario vaya a tomar la foto del marcador (request en tiempo de uso).  
- Evitar permisos de ubicación, contactos o almacenamiento amplio si no son necesarios para el MVP.  
- En **AndroidManifest** (Capacitor): declarar solo los permisos que realmente se usen; Capacitor suele añadir cámara y storage si usas los plugins correspondientes.

---

## 6.2 Cámara

- **Uso:** Solo para capturar foto del marcador (obligatoria) y fotos opcionales por cuarto.  
- **Implementación:**  
  - En web/PWA: `navigator.mediaDevices.getUserMedia` o `<input type="file" accept="image/*" capture="environment">`.  
  - Con Capacitor: **@capacitor/camera** (`Camera.getPhoto`) con `source: CameraSource.CAMERA` y `quality` adecuada para legibilidad del marcador (no hace falta máxima resolución).  
- **UX:**  
  - Instrucción breve: “Toma una foto clara del marcador final.”  
  - Preview antes de confirmar; opción “Otra foto” si salió mal.  
  - En pantalla de cierre, no permitir “Cerrar partido” sin al menos una foto del marcador.

---

## 6.3 Almacenamiento (storage)

- **Offline-first:** IndexedDB (en WebView de Capacitor funciona igual que en navegador) para partidos, eventos, plantilla, etc.  
- **Fotos:**  
  - Opción A: Subir directamente al servidor cuando hay red; no guardar copia local permanente (sí en memoria para preview).  
  - Opción B: Guardar en almacenamiento local o en directorio de la app (Capacitor Filesystem) si se sube después; útil cuando se cierra partido offline.  
- **Android 10+:** Usar Scoped Storage; evitar acceso amplio a almacenamiento externo. Con Capacitor, **Capacitor Filesystem** y **Camera** ya suelen respetar buenas prácticas.  
- **Límites:** IndexedDB y almacenamiento de app tienen límites por origen; para muchos partidos y eventos en texto, suele ser suficiente; si se guardan muchas fotos en local, considerar borrado de caché antigua o subida y borrado tras sync.

---

## 6.4 UX para Play Store y usuarios

- **Primera apertura:** Breve onboarding (1–2 pantallas): “Anota partidos sin internet; todo se sincroniza cuando haya conexión.”  
- **Claridad de estados:**  
  - Offline / Pendiente de sincronizar (N eventos) / Sincronizando / Todo sincronizado.  
  - Botón visible “Sincronizar ahora” cuando haya pendientes.  
- **Accesibilidad:**  
  - Áreas de toque grandes (mín. 44px) en captura rápida.  
  - Contraste suficiente para uso en cancha (sol/techo).  
  - Opción de vibración al registrar evento (configurable).  
- **Rendimiento:**  
  - Carga inicial rápida; lista de partidos del día sin bloqueos.  
  - No bloquear la UI al guardar eventos (todo asíncrono).  
- **Manejo de errores:**  
  - Mensajes claros si falla la sincronización (“Revisa tu conexión y vuelve a intentar”).  
  - No perder datos: todo persistido en local hasta confirmar envío al servidor.

---

## 6.5 Políticas de Google Play

- **Política de contenido:** La app es de gestión deportiva amateur (estadísticas, actas); no incluye apuestas ni contenido prohibido. Descripción y capturas deben reflejar solo estas funciones.  
- **Datos personales:** Si se almacenan nombres de jugadores y anotadores, incluir en la **Política de privacidad** qué se recoge, para qué se usa y que se sincroniza con servidor del organizador de la liga. En la ficha de Play Store, rellenar la sección “Datos que recopila la app” (identificadores, datos de rendimiento si aplica).  
- **Permisos:** Justificar en la ficha cada permiso (ej. “Cámara: para tomar la foto del marcador al final del partido”).  
- **Cuenta de desarrollador:** Cuenta de Google Play Developer (pago único); verificar identidad si es necesario.  
- **Formato de app:** AAB (Android App Bundle) es obligatorio para nuevas apps; Capacitor genera proyecto Android que se puede firmar y subir como AAB desde Android Studio o línea de comandos.

---

## 6.6 Checklist previo a publicación

- [ ] Permisos mínimos; cámara solicitada en momento de uso.  
- [ ] Política de privacidad publicada y enlazada en la ficha.  
- [ ] Descripción y capturas que reflejen solo anotación y gestión de partidos (sin apuestas).  
- [ ] Offline-first probado: captura y cierre sin red; sincronización al recuperar red.  
- [ ] Foto obligatoria del marcador probada en dispositivo real.  
- [ ] App firmada (release keystore); versión y versionCode correctos.  
- [ ] Rellenada la sección “Datos que recopila la app” en Play Console.  
- [ ] Probar en varios tamaños de pantalla y en Android 10+ (storage y permisos).

Con esto la app queda alineada con **permisos**, **cámara**, **storage**, **UX** y **políticas** de Play Store para un producto real de basketball amateur.
