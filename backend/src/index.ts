import express from 'express';
import cors from 'cors';
import analyzeRouter  from './routes/analyze';
import impactRouter   from './routes/impact';
import repairRouter   from './routes/repair';
import reportRouter   from './routes/report';
import projectRouter  from './routes/project';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
// Raw body for JSON; multipart handled by multer in project router
app.use(express.json({ limit: '4mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'vectra-backend', version: '1.0.0' });
});

// Analysis
app.use('/api/analyze', analyzeRouter);

// Impact tracing
app.use('/api/impact', impactRouter);

// Repair + Review (Bob)
app.use('/api/repair', repairRouter);

// Report
app.use('/api/report', reportRouter);

// Project import / management
app.use('/api/project', projectRouter);

app.listen(PORT, () => {
  console.log(`VECTRA backend running on http://localhost:${PORT}`);
});

export default app;
