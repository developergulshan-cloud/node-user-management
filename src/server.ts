import express from 'express';
const dabAPI = require('dynamic-api-builder-js');
// const mysqlapis = require('./api-config.json')
import mysqlapis from '../api-config.json';
import { DatabaseConfig, DatabaseConnection } from './config/database';
const app = express();
app.use(express.json());

// INITIALIZE USER MANAGEMENT TABLE
let database: DatabaseConfig = {
  host: 'localhost',
  user: 'gulshan',
  password: 'Gulshan@814144',
  database: 'user_management',
}

let um_table_migration = new DatabaseConnection(database);
um_table_migration.initialize();

// INITIALIZE DAB API
const mysqlconfig = {
  type: 'mysql',
  database: {
    host: 'localhost',
    user: 'gulshan',
    password: 'Gulshan@814144',
    database: 'user_management',
    port: 3306
  },
  apis: mysqlapis.apis
};
let mysqlApiConfig = dabAPI(mysqlconfig).router;
app.use('/api', mysqlApiConfig);

app.get('/', (req, res) => {
  res.json({ message: 'User Management API' });
});

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default app;
