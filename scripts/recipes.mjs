import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function loadRecipes(ids) {
  const folder = new URL('../recipes/', import.meta.url);
  const files = (await readdir(folder))
    .filter((name) => name.endsWith('.ts') && (!ids || ids.has(name.slice(0, -3))))
    .sort();
  return Promise.all(files.map(async (file) => {
    const id = file.slice(0, -3);
    const { default: recipe } = await import(new URL(file, folder).href);
    if (!ID.test(id) || recipe?.id !== id || typeof recipe.render !== 'function') {
      throw new Error(`${file} must default-export the SoundRecipe with id ${id}`);
    }
    return recipe;
  }));
}

export async function loadMusicRecipes(score) {
  const ids = new Set(score?.tracks.flatMap(track => track.recipe ? [track.recipe] : []));
  return new Map(ids.size ? (await loadRecipes(ids)).map(recipe => [recipe.id, recipe]) : []);
}
