const PDFDocument = require('pdfkit');
const path = require('path');

module.exports = {
    generateStatsPDF: (stats, res) => {
        const doc = new PDFDocument({ margin: 50 });

        // Rediriger vers la réponse
        doc.pipe(res);

        // En-tête
        doc.fillColor('#0f3d2e')
            .fontSize(20)
            .text('Rapport Analytique - OSEP', { align: 'center' });

        doc.moveDown();
        doc.fontSize(12).text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
        doc.moveDown(2);

        // Section des indicateurs
        doc.fillColor('#000000').fontSize(16).text('1. Indicateurs', { underline: true });
        doc.moveDown();
        doc.fontSize(12).text(`Temps Total de Réunion: ${stats.totalHours}h`);
        doc.text(`Réunions (Période): ${stats.trends.reduce((acc, curr) => acc + curr.count, 0)}`);

        doc.moveDown(2);

        // Section des coordinations
        doc.fontSize(16).text('2. Top Coordinations', { underline: true });
        doc.moveDown();
        stats.radar.forEach((r, i) => {
            doc.fontSize(12).text(`${i + 1}. ${r.name}: ${r.count} réunions`);
        });

        doc.moveDown(2);

        // Section des réunions intactes et modifiées
        doc.fontSize(16).text('3. Qualité et Intégrité des Réunions', { underline: true });
        doc.moveDown();

        const intacts = stats.modificationsData?.intactMeetings || [];
        const modifieds = stats.modificationsData?.modifiedMeetings || [];

        // Réunions Intactes
        doc.fontSize(14).fillColor('#22c55e').text(`Réunions Intactes (${intacts.length}) :`, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#555');
        if (intacts.length === 0) {
            doc.text('Aucune réunion intacte.');
        } else {
            intacts.forEach((mTitle) => {
                const titleStr = mTitle ? mTitle.replace(/\n|\r/g, ' ') : 'Sans titre';
                doc.text(`• ${titleStr}`);
            });
        }

        doc.moveDown(1.5);

        // Helper function for elapsed time
        const calculateElapsedFormatted = (dateInput) => {
            const diff = Date.now() - new Date(dateInput).getTime();
            const minutes = Math.floor(diff / 60000);
            if (minutes < 60) return `${minutes} minute(s)`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours} heure(s)`;
            const days = Math.floor(hours / 24);
            if (days < 30) return `${days} jour(s)`;
            const months = Math.floor(days / 30);
            return `${months} mois`;
        };

        // Réunions Modifiées
        doc.fontSize(14).fillColor('#f59e0b').text(`Réunions Modifiées (${modifieds.length}) :`, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#555');
        if (modifieds.length === 0) {
            doc.text('Aucune réunion n\'a été modifiée.');
        } else {
            modifieds.forEach(mod => {
                const userName = mod.user ? mod.user : 'Utilisateur inconnu';
                const elapsedStr = mod.date_modification ? calculateElapsedFormatted(mod.date_modification) : 'Date inconnue';
                const timeStr = mod.date_modification ? new Date(mod.date_modification).toLocaleString('fr-FR') : '';

                doc.font('Helvetica-Bold').fillColor('#333').text(`• ${mod.title || 'Sans titre'} : Modifiée ${mod.times_modified} fois`);
                doc.font('Helvetica').fillColor('#555').text(`  Dernière modification : il y a ${elapsedStr} (le ${timeStr}) par ${userName}`, { indent: 15 });
                doc.moveDown(0.5);
            });
        }

        // Pied de page
        doc.fontSize(10).fillColor('#999').text('Confidentiel - OSEP Admin System', 50, 700, { align: 'center', width: 500 });

        doc.end();
    },
    generateAttendancePDF: (meeting, attendees, res) => {
        // Paramétrage PDF pour éviter le saut de page automatique (qui générait les pages mortes)
        const doc = new PDFDocument({ 
            margins: { top: 30, bottom: 0, left: 30, right: 30 }, 
            size: 'A4', 
            layout: 'landscape',
            autoFirstPage: true
        });
        doc.pipe(res);

        const pageW = 842.89;
        const pageH = 595.28;
        
        // Cadrage parfait, Couleurs d'impression standard
        const colorBorder = '#000000';
        const colorText = '#000000';
        const colorRed = '#c00000';
        const colorHeaderBox = '#f5f5f5';

        const startX = 30;
        const tableW = pageW - startX * 2; // 782.89
        
        const logoBoxW = 120;
        const titleBoxW = 280;
        const totalTopW = logoBoxW + titleBoxW; // 400
        const topX = (pageW - totalTopW) / 2; // Centré
        const topY = 20;
        const topH = 40;

        let currentPage = 1;

        const drawPageHeaderAndBackground = (isFirstPage) => {
            doc.rect(topX, topY, logoBoxW, topH).stroke(colorBorder);
            doc.rect(topX + logoBoxW, topY, titleBoxW, topH).fillAndStroke(colorHeaderBox, colorBorder);
            doc.moveTo(topX + logoBoxW, topY).lineTo(topX + logoBoxW, topY + topH).stroke(colorBorder);

            const logoPath = path.join(__dirname, '../public/logo.jpg');
            try {
                doc.image(logoPath, topX + 5, topY + 5, { width: logoBoxW - 10, height: topH - 10, fit: [logoBoxW-10, topH-10], align: 'center', valign: 'center' });
            } catch (e) {
                // Ignore
            }

            doc.font('Helvetica-Bold').fontSize(16).fillColor(colorText)
               .text('LISTE DE PRESENCE', topX + logoBoxW, topY + 13, { width: titleBoxW, align: 'center' });

            let thY = topY + topH + 20;

            if (isFirstPage) {
                const infoY = thY;
                const row1H = 25;
                const row2H = 25;

                const startDateTime = new Date(meeting.start_time);
                const endDateTime = meeting.end_time ? new Date(meeting.end_time) : null;
                const dateStr = startDateTime.toLocaleDateString('fr-FR');
                const startTimeStr = startDateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const endTimeStr = endDateTime ? endDateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

                doc.rect(startX, infoY, tableW, row1H + row2H).stroke(colorBorder);
                doc.moveTo(startX, infoY + row1H).lineTo(startX + tableW, infoY + row1H).stroke(colorBorder);

                const wLieu = 380;
                const wDate = 140;
                const wHD = 130;

                doc.moveTo(startX + wLieu, infoY).lineTo(startX + wLieu, infoY + row1H).stroke(colorBorder);
                doc.moveTo(startX + wLieu + wDate, infoY).lineTo(startX + wLieu + wDate, infoY + row1H).stroke(colorBorder);
                doc.moveTo(startX + wLieu + wDate + wHD, infoY).lineTo(startX + wLieu + wDate + wHD, infoY + row1H).stroke(colorBorder);

                doc.font('Helvetica-Bold').fontSize(11).fillColor(colorText);
                doc.text(`Lieu : ${meeting.location || 'OSEP'}`, startX + 5, infoY + 7);
                doc.text(`Date : ${dateStr}`, startX + wLieu + 5, infoY + 7);
                doc.text(`H. Début : ${startTimeStr}`, startX + wLieu + wDate + 5, infoY + 7);
                doc.text(`H. Fin : ${endTimeStr}`, startX + wLieu + wDate + wHD + 5, infoY + 7);
                
                doc.text(`OBJET : ${meeting.title || '-'}`, startX + 5, infoY + row1H + 7);

                thY = infoY + row1H + row2H + 10;
            }

            const headerRowH = 25;
            doc.lineWidth(1).rect(startX, thY, tableW, headerRowH).stroke(colorBorder);

            return thY + headerRowH;
        };

        const drawFooter = () => {
            const footerY = pageH - 25; // 25px du fond
            doc.font('Helvetica-Oblique').fontSize(12).fillColor(colorRed);
            const slogan = 'OSEP, le regard sur la qualité du service public';
            const textW = doc.widthOfString(slogan);
            const textX = startX + (tableW - textW) / 2;
            doc.text(slogan, textX, footerY, { lineBreak: false });
        };

        let currentY = drawPageHeaderAndBackground(true);
        drawFooter(); // First page footer

        const colN = startX;              const wN = 30;
        const colNom = colN + wN;         const wNom = 180;
        const colFonc = colNom + wNom;    const wFonc = 170;
        const colEmail = colFonc + wFonc; const wEmail = 180;
        const colCont = colEmail + wEmail;const wCont = 110;
        const colSign = colCont + wCont;  const wSign = tableW - (wN + wNom + wFonc + wEmail + wCont);

        const drawThCols = (y) => {
            [colNom, colFonc, colEmail, colCont, colSign].forEach(x => {
                doc.moveTo(x, y - 25).lineTo(x, y).stroke(colorBorder);
            });
            doc.font('Helvetica-Bold').fontSize(11).fillColor(colorText);
            doc.text('N°', colN, y - 18, { width: wN, align: 'center' });
            doc.text('Nom et Prénoms', colNom, y - 18, { width: wNom, align: 'center' });
            doc.text('Fonction', colFonc, y - 18, { width: wFonc, align: 'center' });
            doc.text('Adresse E-mail', colEmail, y - 18, { width: wEmail, align: 'center' });
            doc.text('Contacts', colCont, y - 18, { width: wCont, align: 'center' });
            doc.text('Signature', colSign, y - 18, { width: wSign, align: 'center' });
        };

        drawThCols(currentY);

        const rowHeight = 45;
        let rowCount = 0;

        const VISA_ZONE_H = 85; // Espace réservé en bas pour VISA + ligne + marge

        const drawRow = (participant) => {
            // Déclencher nouvelle page si la ligne + zone VISA dépasse le bas de page
            if (currentY + rowHeight > pageH - VISA_ZONE_H) {
                doc.addPage({ margin: { top: 30, bottom: 0, left: 30, right: 30 }, size: 'A4', layout: 'landscape' });
                currentPage++;
                currentY = drawPageHeaderAndBackground(false);
                drawThCols(currentY);
                drawFooter();
            }

            doc.rect(startX, currentY, tableW, rowHeight).stroke(colorBorder);
            [colNom, colFonc, colEmail, colCont, colSign].forEach(x => {
                doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke(colorBorder);
            });

            rowCount++;
            doc.font('Helvetica-Bold').fontSize(10).fillColor(colorText);
            const numStr = rowCount.toString().padStart(2, '0');
            doc.text(numStr, colN, currentY + 18, { width: wN, align: 'center' });

            if (participant) {
                doc.font('Helvetica-Bold').fontSize(10);
                const nomComplet = [participant.nom, participant.prenom].filter(Boolean).join(' ');
                
                doc.text(nomComplet || '', colNom + 5, currentY + 18, { width: wNom - 10, align: 'left', ellipsis: true });
                doc.text(participant.fonction || participant.structure || '', colFonc + 5, currentY + 18, { width: wFonc - 10, align: 'left', ellipsis: true });
                doc.text(participant.email || '', colEmail + 5, currentY + 18, { width: wEmail - 10, align: 'left', ellipsis: true });
                doc.text(participant.telephone || '', colCont + 5, currentY + 18, { width: wCont - 10, align: 'center' });
                
                if (participant.signature && participant.signature.startsWith('data:image')) {
                    try {
                        const base64Data = participant.signature.replace(/^data:image\/\w+;base64,/, "");
                        const signatureBuffer = Buffer.from(base64Data, 'base64');
                        doc.image(signatureBuffer, colSign + 5, currentY + 5, { fit: [wSign - 10, rowHeight - 10], align: 'center', valign: 'center' });
                    } catch (e) {}
                }
            }
            
            currentY += rowHeight;
        };

        // Dessiner tous les participants (et seulement eux)
        attendees.forEach(p => drawRow(p));

        // --- VISA : toujours ancré en bas fixe de la dernière page ---
        // Position fixe : pageH - 80 (au-dessus du slogan footer à pageH-25)
        const visaY = pageH - VISA_ZONE_H;

        doc.font('Helvetica-Bold').fontSize(13).fillColor(colorText);
        doc.text('VISA ANIMATEUR', startX + 50, visaY);
        doc.text('VISA DIRECTEUR', startX + tableW - 210, visaY);

        // Lignes de signature sous les titres VISA
        doc.lineWidth(0.8);
        doc.moveTo(startX + 50,         visaY + 38).lineTo(startX + 240,         visaY + 38).stroke(colorBorder);
        doc.moveTo(startX + tableW - 210, visaY + 38).lineTo(startX + tableW - 30, visaY + 38).stroke(colorBorder);

        doc.end();
    },

    generateDischargePDF: (data, res) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        doc.pipe(res);

        const accentColor = '#dc2626'; // Rouge pour la suppression

        // En-tête
        doc.fillColor(accentColor).fontSize(20).font('Helvetica-Bold')
            .text('DÉCHARGE DE SUPPRESSION DE DONNÉES', { align: 'center' });

        doc.moveDown();
        doc.fontSize(12).fillColor('#000').font('Helvetica')
            .text(`Document généré le : ${new Date().toLocaleString('fr-FR')}`, { align: 'right' });

        doc.moveDown(2);

        // Corps du document
        doc.fontSize(14).font('Helvetica-Bold').text('Objet : Purge de compte et réinitialisation de quota (Bouclier OSEP)');
        doc.moveDown();

        doc.fontSize(12).font('Helvetica').text(`Je soussigné, utilisateur lié à l'adresse email :`, { continued: true });
        doc.font('Helvetica-Bold').text(` ${data.email}`);

        doc.moveDown();
        doc.font('Helvetica').text(`Confirme avoir volontairement demandé la suppression de tous les comptes associés à cet appareil sur le système OSEP.`);

        doc.moveDown();
        doc.text('Détails techniques de la demande :');
        doc.fontSize(10).font('Courier')
            .text(`- Empreinte Appareil (SHA-256) : ${data.fingerprint}`)
            .text(`- Adresse IP : ${data.ip}`)
            .text(`- Action : QUOTA_PURGE_DISCHARGE`);

        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica').text('Cette action est irréversible. Les émargements futurs sur cet appareil nécessiteront une nouvelle identification complète.');

        doc.moveDown(3);
        doc.text('__________________________', { align: 'right' });
        doc.text('Signature numérique (Validée par SIEM)', { align: 'right' });

        // Pied de page
        doc.fontSize(8).fillColor('#9ca3af').text(
            'Système OSEP - Sécurité Zero Trust - Preuve d\'intégrité SIEM active',
            50, 780, { align: 'center', width: 500 }
        );

        doc.end();
    }
};
