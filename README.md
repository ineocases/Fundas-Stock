# iNeo Gestión V35

Login aislado en `js/auth-boot-v35.js`.
La aplicación principal `js/ineo-final.js` se carga únicamente después de que Firebase Authentication confirma la sesión.

Esto evita que un error del módulo grande de la aplicación bloquee el formulario de login.

El navegador no conserva parámetros de email/password en la URL.

Subir todo el contenido del ZIP al repositorio y dejar que Vercel despliegue.
