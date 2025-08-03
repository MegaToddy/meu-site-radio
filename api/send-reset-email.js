const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Método não permitido.');
    }

    try {
        const { email, subject, body } = req.body;

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const mailOptions = {
            from: process.env.SMTP_USER,
            to: email,
            subject: subject,
            html: body,
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'E-mail enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        res.status(500).json({ error: 'Erro ao enviar o e-mail.' });
    }
};