import { expect, test } from 'vitest'
import { fitWithin } from './image'

test('landscape phone photo shrinks to 1600 on the long side', () => {
  expect(fitWithin(4032, 3024)).toEqual([1600, 1200])
})
test('portrait keeps its orientation', () => {
  expect(fitWithin(3024, 4032)).toEqual([1200, 1600])
})
test('small images are never upscaled', () => {
  expect(fitWithin(800, 600)).toEqual([800, 600])
})
test('exactly at the limit is untouched', () => {
  expect(fitWithin(1600, 900)).toEqual([1600, 900])
})
test('pet photo thumbnails fit in 256 px', () => {
  expect(fitWithin(4032, 3024, 256)).toEqual([256, 192])
})
