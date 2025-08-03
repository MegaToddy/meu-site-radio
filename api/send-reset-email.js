const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { type, qra, password, email, newPassword, newEmail, frequencies } = req.body;

    try {
        switch (type) {
            case 'login':
                const { data: user, error: loginError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('qra', qra)
                    .single();

                if (loginError || !user || user.password !== password) {
                    return res.status(401).json({ error: 'QRA ou senha incorretos.' });
                }

                res.status(200).json({ message: 'Login bem-sucedido.', user });
                break;

            case 'createUser':
                const { data: existingUser, error: existingUserError } = await supabase
                    .from('users')
                    .select('qra')
                    .eq('qra', qra)
                    .single();

                if (existingUserError && existingUserError.code !== 'PGRST116') {
                    throw existingUserError;
                }

                if (existingUser) {
                    return res.status(409).json({ error: 'Este QRA já existe.' });
                }

                const { data: newUser, error: createUserError } = await supabase
                    .from('users')
                    .insert([{ qra, password, email: '', frequencies: '[]' }])
                    .select();

                if (createUserError) {
                    throw createUserError;
                }

                res.status(201).json({ message: 'Conta criada com sucesso!', user: newUser[0] });
                break;

            case 'changePassword':
                const { data: passwordUpdate, error: passwordUpdateError } = await supabase
                    .from('users')
                    .update({ password: newPassword })
                    .eq('qra', qra)
                    .eq('password', password); // Confere a senha atual

                if (passwordUpdateError || !passwordUpdate) {
                    return res.status(401).json({ error: 'Senha atual incorreta.' });
                }

                res.status(200).json({ message: 'Senha alterada com sucesso!' });
                break;

            case 'changeEmail':
                const { data: emailUpdate, error: emailUpdateError } = await supabase
                    .from('users')
                    .update({ email: newEmail })
                    .eq('qra', qra);

                if (emailUpdateError) {
                    throw emailUpdateError;
                }

                res.status(200).json({ message: 'Email alterado com sucesso!' });
                break;

            case 'saveFrequencies':
                const { error: freqError } = await supabase
                    .from('users')
                    .update({ frequencies })
                    .eq('qra', qra);
                
                if (freqError) {
                    throw freqError;
                }

                res.status(200).json({ message: 'Frequências salvas com sucesso!' });
                break;

            case 'requestPasswordReset':
                const { data: userReset, error: userResetError } = await supabase
                    .from('users')
                    .select('email')
                    .eq('qra', qra)
                    .single();

                if (userResetError || !userReset || userReset.email !== email || !email) {
                    return res.status(401).json({ error: 'QRA ou email não correspondem a uma conta válida.' });
                }

                const resetCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                
                const { error: updatePasswordError } = await supabase
                    .from('users')
                    .update({ password: resetCode })
                    .eq('qra', qra);

                if (updatePasswordError) {
                    throw updatePasswordError;
                }

                const subject = 'Código de Redefinição de Senha';
                const body = `Olá, ${qra}.<br><br>Seu código de redefinição de senha é: <b>${resetCode}</b>.<br>Use-o para fazer login e, em seguida, altere sua senha no seu perfil.`;

                const mailOptions = {
                    from: process.env.SMTP_USER,
                    to: email,
                    subject: subject,
                    html: body,
                };

                await transporter.sendMail(mailOptions);

                res.status(200).json({ message: 'Código de redefinição enviado com sucesso!' });
                break;

            default:
                res.status(400).json({ error: 'Tipo de requisição inválido.' });
        }
    } catch (error) {
        console.error('Erro na função Vercel:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};
