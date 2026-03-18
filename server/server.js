const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve web portal & admin panel
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/journey',   require('./routes/journey'));
app.use('/api/transport', require('./routes/transport'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/safety',    require('./routes/safety'));
app.use('/api/track',     require('./routes/track'));
app.use('/api/ai',        require('./routes/ai'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Safe2Journey server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
  });
}

module.exports = app;
