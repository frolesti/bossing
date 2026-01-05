#!/usr/bin/env node
import { getEnabledScrapers, getScraper, type ScraperResult } from './index.js';

interface CliArgs {
  source?: string;
  category?: string;
  verbose?: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--source' || arg === '-s') {
      args.source = argv[++i];
    } else if (arg === '--category' || arg === '-c') {
      args.category = argv[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs();
  
  console.log('🛒 Bossing Scraper CLI');
  console.log('='.repeat(40));

  let scrapersToRun = getEnabledScrapers();

  if (args.source) {
    const scraper = getScraper(args.source);
    if (!scraper) {
      console.error(`❌ Scraper "${args.source}" no trobat.`);
      console.log('Scrapers disponibles:', scrapersToRun.map((s) => s.getName()).join(', '));
      process.exit(1);
    }
    scrapersToRun = [scraper];
  }

  console.log(`\n📦 Executant ${scrapersToRun.length} scraper(s)...\n`);

  const results: ScraperResult[] = [];

  for (const scraper of scrapersToRun) {
    console.log(`▶️  ${scraper.getName()}...`);
    
    try {
      const result = await scraper.run(args.category);
      results.push(result);
      
      console.log(`   ✅ ${result.products.length} productes obtinguts (${result.duration}ms)`);
      
      if (result.errors.length > 0) {
        console.log(`   ⚠️  ${result.errors.length} errors:`, result.errors);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log('\n' + '='.repeat(40));
  console.log('📊 Resum:');
  
  const totalProducts = results.reduce((acc, r) => acc + r.products.length, 0);
  const totalErrors = results.reduce((acc, r) => acc + r.errors.length, 0);
  const totalDuration = results.reduce((acc, r) => acc + r.duration, 0);

  console.log(`   Total productes: ${totalProducts}`);
  console.log(`   Total errors: ${totalErrors}`);
  console.log(`   Temps total: ${totalDuration}ms`);
  
  // TODO: Guardar resultats a la base de dades
  console.log('\n✨ Scraping completat!');
}

main().catch(console.error);
