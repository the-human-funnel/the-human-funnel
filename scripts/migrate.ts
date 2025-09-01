#!/usr/bin/env ts-node

import { MongoClient, Db } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import config from '../src/config';

interface Migration {
  version: string;
  description: string;
  up: (db: Db) => Promise<void>;
  down: (db: Db) => Promise<void>;
}

class MigrationRunner {
  private client: MongoClient;
  private db: Db;
  private migrationsPath: string;

  constructor() {
    const dbConfig = config.getSecretsConfig();
    this.client = new MongoClient(config.getAppConfig().database.mongodb.uri);
    this.migrationsPath = path.join(__dirname, 'migrations');
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db();
    console.log('Connected to MongoDB');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  async ensureMigrationsCollection(): Promise<void> {
    const collections = await this.db.listCollections({ name: 'migrations' }).toArray();
    if (collections.length === 0) {
      await this.db.createCollection('migrations');
      console.log('Created migrations collection');
    }
  }

  async getAppliedMigrations(): Promise<string[]> {
    const migrations = await this.db.collection('migrations')
      .find({}, { projection: { version: 1 } })
      .sort({ version: 1 })
      .toArray();
    
    return migrations.map(m => m.version);
  }

  async recordMigration(version: string, description: string): Promise<void> {
    await this.db.collection('migrations').insertOne({
      version,
      description,
      appliedAt: new Date()
    });
  }

  async removeMigrationRecord(version: string): Promise<void> {
    await this.db.collection('migrations').deleteOne({ version });
  }

  loadMigrations(): Migration[] {
    if (!fs.existsSync(this.migrationsPath)) {
      console.log('No migrations directory found');
      return [];
    }

    const migrationFiles = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();

    const migrations: Migration[] = [];
    
    for (const file of migrationFiles) {
      const migrationPath = path.join(this.migrationsPath, file);
      try {
        const migration = require(migrationPath);
        migrations.push(migration.default || migration);
      } catch (error) {
        console.error(`Failed to load migration ${file}:`, error);
      }
    }

    return migrations;
  }

  async runMigrations(): Promise<void> {
    await this.ensureMigrationsCollection();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const allMigrations = this.loadMigrations();
    
    const pendingMigrations = allMigrations.filter(
      migration => !appliedMigrations.includes(migration.version)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pendingMigrations.length} pending migrations...`);

    for (const migration of pendingMigrations) {
      try {
        console.log(`Applying migration ${migration.version}: ${migration.description}`);
        await migration.up(this.db);
        await this.recordMigration(migration.version, migration.description);
        console.log(`✓ Migration ${migration.version} applied successfully`);
      } catch (error) {
        console.error(`✗ Migration ${migration.version} failed:`, error);
        throw error;
      }
    }

    console.log('All migrations completed successfully');
  }

  async rollbackMigration(version?: string): Promise<void> {
    await this.ensureMigrationsCollection();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const allMigrations = this.loadMigrations();
    
    if (appliedMigrations.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const targetVersion = version || appliedMigrations[appliedMigrations.length - 1];
    const migration = allMigrations.find(m => m.version === targetVersion);
    
    if (!migration) {
      throw new Error(`Migration ${targetVersion} not found`);
    }

    if (!appliedMigrations.includes(targetVersion)) {
      throw new Error(`Migration ${targetVersion} has not been applied`);
    }

    try {
      console.log(`Rolling back migration ${migration.version}: ${migration.description}`);
      await migration.down(this.db);
      await this.removeMigrationRecord(migration.version);
      console.log(`✓ Migration ${migration.version} rolled back successfully`);
    } catch (error) {
      console.error(`✗ Rollback of migration ${migration.version} failed:`, error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'up';
  
  const runner = new MigrationRunner();
  
  try {
    await runner.connect();
    
    switch (command) {
      case 'up':
        await runner.runMigrations();
        break;
      case 'down':
        const version = args[1];
        await runner.rollbackMigration(version);
        break;
      case 'status':
        const applied = await runner.getAppliedMigrations();
        const all = runner.loadMigrations();
        console.log('Applied migrations:', applied);
        console.log('Available migrations:', all.map(m => m.version));
        break;
      default:
        console.log('Usage: migrate [up|down|status] [version]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await runner.disconnect();
  }
}

if (require.main === module) {
  main();
}

export default MigrationRunner;