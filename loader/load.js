import axios from 'axios'
import commandLineArgs from 'command-line-args'
import fs from 'fs'
import natural from 'natural'
import readline from 'readline'


// parse command line options
const options = commandLineArgs([
  { name: 'file', type: String, defaultOption: true},
  { name: 'startingId', type: String }
])

// set up a tokenizer and a line reader
const tokenizer = new natural.WordTokenizer()
const rl = readline.createInterface({
  input: fs.createReadStream(options.file),
  terminal: false
})

// set up a counters and flags
let count = 0
let maxTokens = 0
let startWith = options.startingId
let process = !startWith

// loop over each line of the file
for await (const line of rl) {

  // increment the count
  count++

  // parse the line as JSON, start the timer, and log the sighting id
  const sighting = JSON.parse(line)
  console.time(sighting.id)
  console.log(count, `📖 Read Bigfoot sighting ${sighting.id}.`)

  // tokenize the observed text and log the number of tokens
  const tokens = tokenizer.tokenize(sighting.observed ?? '')
  if (tokens.length > maxTokens) maxTokens = tokens.length
  console.log(count, `👀 Sighting ${sighting.id} has ${tokens.length} tokens. Max so far is ${maxTokens}.`)

  // if we are starting with a specific sighting, skip until we get there
  if (sighting.id === startWith) process = true
  if (!process) {
    console.log(count, `🙅 Skipped!`)
    console.timeEnd(sighting.id)
    continue
  }

  // post the sighting to the API and log it
  const response = await axios.post('http://localhost:80/load', sighting)
  console.log(count, `📄 Posted sighting ${sighting.id} with response ${JSON.stringify(response.data.response)}.`)

  // log the time it took to process the sighting
  console.timeEnd(sighting.id)
}

// log the final count and max tokens
console.log(`👣 Processing done. Total count = ${count}, max tokens = ${maxTokens}.`)
