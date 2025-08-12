import express from 'express';
import session from 'express-session';
import path from 'path';
import { camerasConfig } from './config/camera';
import { env } from './config/env';

const app = express();
const PORT = env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
);

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware kiểm tra đăng nhập
function requireLogin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// Routes
app.get('/login', (_req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // user cứng
  if (username === 'admin' && password === 'admin') {
    req.session.user = username;
    return res.redirect('/');
  }
  res.render('login', { error: 'Invalid credentials' });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/', requireLogin, (_req, res) => {
  res.render('index', { cameras: camerasConfig });
});

app.get('/camera/:ip', requireLogin, (req, res) => {
  const ip = req.params.ip;
  const camera = camerasConfig.find((c) => c.ip === ip);
  if (!camera) return res.status(404).send('Camera not found');
  res.render('camera', { camera });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
