import fs from 'fs'
import puppeteer from 'puppeteer'
import prompt from 'prompt'

function extractItems() {
  const extractedElements = document.querySelectorAll('.infinite-scroll-component a.no-style')

  if (Array.from(extractedElements).length === 0) {
    throw new Error('Could not find any items.')
  }

  const items = []

  for (let el of extractedElements) {
    items.push(el.href)
  }

  return items
}

async function scrapeItems(page, extractItems, itemCount, scrollDelay = 800) {
  let items = []

  await page.waitForSelector('.infinite-scroll-component')

  try {
    let previousHeight
    while (items.length < itemCount) {
      items = await page.evaluate(extractItems)
      console.log(`👉 Scraped ${items.length} of ${itemCount} items`)
      if (items.length === itemCount) break
      previousHeight = await page.evaluate('document.body.scrollHeight')
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
      await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`)
      await page.waitForTimeout(scrollDelay)
    }
  } catch (error) {}

  return items
}

async function useCollectionInfo(page) {
  // Get the collection title
  const collectionTitleDiv = await page.waitForSelector('[data-test-id="collection-title"]')
  const collectionTitle = await collectionTitleDiv.evaluate(el => el.textContent)

  // Get the number of collectibles
  const collectiblesDiv = await page.waitForSelector('[data-test-id="collection-items-count"]')
  let count = await collectiblesDiv.evaluate(el => el.textContent)
  count = Number(count)

  return { collectionTitle, count }
}

async function main() {
  // Let user type in the collection link
  const { link } = await prompt.get(['link'])

  // Start to measure execution time
  const start = new Date()

  // Boot up a new Chromium instance
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  page.setViewport({ width: 1280, height: 926 })

  // Navigate to the page
  await page.goto(link)

  // Get collection title and collectibles count
  const { collectionTitle, count } = await useCollectionInfo(page)

  console.log(`🎉 Found collection: ${collectionTitle}`)
  console.log(`🎲 Items: ${count}`)
  console.log(`\n⏳ Start crawling. This will take a few ${count > 100 ? 'minutes' : 'seconds'}...`)

  const items = await scrapeItems(page, extractItems, count)

  fs.writeFileSync(
    './items.txt',
    `Collection: ${collectionTitle}\nLink: ${link}\nItems: ${count}\n\n`
  )
  fs.appendFileSync('./items.txt', items.join('\n') + '\n')

  await browser.close()

  console.log(`✅ Done. Saved item links to items.txt`)

  const end = (new Date() - start) / 1000
  console.log(`✨ Took ${parseFloat(end).toFixed(2)}s`)
}

main()
