import { ChatPromptTemplate } from '@langchain/core/prompts'

import { embeddingModel, summarizationModel } from './models.js'
import { redis } from './redis.js'


export async function save(sighting) {

  const summary = await summarize(sighting.observed)
  const embeddingBytes = await embed(summary)

  const key = `bigfoot:sighting:${sighting.id}`
  redis.hSet(key, sighting)
  redis.hSet(key, 'summary', summary)
  await redis.hSet(key, 'embedding', embeddingBytes)

  return `Added sighting ${sighting.id} to vector store using summary:\n${summary}`
}

export async function search(query, count) {

  const embedding = await embeddingModel.embedQuery(query)
  const embeddingBytes = Buffer.from(Float32Array.from(embedding).buffer)
  const redisQuery = `*=>[KNN ${count} @embedding $BLOB]`

  const searchResults = await redis.ft.search('bigfoot:sighting:index', redisQuery, {
    DIALECT: 2,
    PARAMS: { 'BLOB': embeddingBytes },
    RETURN: [ 'id', 'title', 'observed', 'classification', 'county', 'state' ]
  })

  const results =  searchResults.documents.map(document => document.value)

  return results
}

async function summarize(text) {

  const instructionTemplate = `
    You are a helpful assistant who summarize accounts of Bigfoot sightings. These
    summaries will be used to generate embeddings for the sightings so that they can be
    searched using vector search. You will be given an account of a Bigfoot sighting and
    you will summarize it using no more than 512 words. You will ONLY return the summary,
    and nothing more. You will NEVER return more than 512 words.`

  const sightingTemplate = "{sighting}"

  const chatPrompt = ChatPromptTemplate.fromMessages([
    ["system", instructionTemplate],
    ["system", sightingTemplate]
  ])

  const summary = await chatPrompt.pipe(summarizationModel).invoke({
    sighting: text
  })

  return summary
}

async function embed(text) {
  const embedding = await embeddingModel.embedQuery(text)
  const embeddingBytes = Buffer.from(Float32Array.from(embedding).buffer)
  return embeddingBytes
}