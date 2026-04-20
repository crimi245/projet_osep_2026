// INSTRUCTIONS DE RÉCUPÉRATION MANUELLE
//
// Le fichier server.js a été corrompu. Voici comment le restaurer :
//
// OPTION 1 (RECOMMANDÉE) - Si vous avez VS Code ouvert avec server.js :
//   1. Ouvrez server.js dans VS Code
//   2. Appuyez sur Ctrl+Z plusieurs fois pour annuler les modifications
//   3. Le fichier devrait revenir à son état original
//
// OPTION 2 - Si vous avez Git :
//   1. Exécutez : git checkout server.js
//   2. Ou : git restore server.js
//
// OPTION 3 - Restauration depuis une sauvegarde :
//   1. Cherchez un fichier de sauvegarde dans votre système
//   2. Copiez-le vers server.js
//
// OPTION 4 - Redémarrage du serveur pour voir l'erreur :
//   1. Arrêtez le serveur Node.js actuel (Ctrl+C)
//   2. Essayez de le redémarrer - il va échouer
//   3. Cela confirmera que nous devons restaurer le fichier
//
// ENSUITE, une fois le fichier restauré, ajoutez cette route après la ligne 171 :
//
// app.get('/links', isAuthenticated, (req, res) => {
//     if (req.session.user.role === 'admin') {
//         res.sendFile(path.join(__dirname, 'view', 'meeting_links.html'));
//     } else {
//         res.sendFile(path.join(__dirname, 'view', 'meeting_links_user.html'));
//     }
// });
//
// Cela résoudra le problème où cliquer sur "Liens & QR Codes" redirige vers le dashboard.

console.log('Lisez les instructions ci-dessus pour restaurer server.js');
