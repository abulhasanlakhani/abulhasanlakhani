const fetch = require('isomorphic-fetch');
const { promises: fs } = require('fs');
const { Html5Entities } = require('html-entities');
const replaceAll = require('string.prototype.replaceall');
const { JSDOM } = require('jsdom');
const FileType = require('file-type');
const { func } = require('prop-types');

function getImageName(path) {
  return path.split('/').pop();
}

function getFolder(folderName) {
  const decodedFolderName = Html5Entities.decode(folderName)
    .trim()
    .replace(':', ' - ');

  return decodedFolderName.replace(/[^A-Za-z0-9 \-:]/g, '');
}

// function findImagePaths(content) {
//   const DOM = new JSDOM(content);
//   const imgs = DOM.window.document.querySelectorAll('img');
//   return Array.from(imgs).map(img => img.src);
// }

async function categoryGetter() {
  const tags = await fetch(
    'https://abulhasanlakhani.com/wp-json/wp/v2/categories?per_page=100'
  ).then(x => x.json());
  return function getCategory(id) {
    return tags.find(tag => tag.id === id).name;
  };
}

async function getCategories(parentId) {
  const categories = fetch(
    `https://abulhasanlakhani.com/wp-json/wp/v2/categories?parent=${parentId}&per_page=100&page=1`
  ).then(x => x.json());

  const cats = await categories;

  const content = cats.flat();

  return content;
}

async function getPosts() {
  const p1 = fetch(
    'https://abulhasanlakhani.com/wp-json/wp/v2/posts?per_page=100&page=1'
  ).then(x => x.json());
  const p2 = fetch(
    'https://abulhasanlakhani.com/wp-json/wp/v2/posts?per_page=100&page=2'
  ).then(x => x.json());
  const content = (await Promise.all([p1, p2])).flat();
  return content;
}

async function getPostsByArtist(artistId) {
  const p1 = fetch(
    `https://abulhasanlakhani.com/wp-json/wp/v2/posts?categories=${artistId}&per_page=100&page=1`
  ).then(x => x.json());
  const content = (await p1).flat();
  return content;
}

function replacify(text) {
  let replacedText;
  // this replaces all kinds of stuff that needs to be converted back to markdown, or makes gatsby MDX choke
  replacedText = Html5Entities.decode(text);

  replacedText = replaceAll(
    replacedText,
    '<p style="text-align: left;">',
    '<p>'
  );
  replacedText = replaceAll(
    replacedText,
    '<p class="has-normal-font-size">',
    '<p>'
  );
  replacedText = replaceAll(
    replacedText,
    '<img src="facebook-share2.png">',
    '<img src="facebook-share2.png" />'
  );

  replacedText = replaceAll(replacedText, '<br>', '<br/>');
  replacedText = replaceAll(replacedText, '<hr>', '<hr/>');
  replacedText = replaceAll(replacedText, '<li>', '* ');
  replacedText = replaceAll(replacedText, '</li>', '\n');
  replacedText = replaceAll(replacedText, '<ul>', '\n');
  replacedText = replaceAll(replacedText, '</ul>', '');
  replacedText = replaceAll(replacedText, '<ol>', '\n');
  replacedText = replaceAll(replacedText, '</ol>', '');
  replacedText = replaceAll(replacedText, '<strong>', '**');
  replacedText = replaceAll(replacedText, '</strong>', '**');
  replacedText = replaceAll(
    replacedText,
    '<img src="iphone-tel.gif">',
    '<img src="iphone-tel.gif"/>'
  );
  replacedText = replaceAll(
    replacedText,
    '<style>.entry-utility {clear:both;}</style>',
    ''
  );
  replacedText = replaceAll(
    replacedText,
    `<ul class="blocks-gallery-grid"><li class="blocks-gallery-item">`,
    ''
  );
  replacedText = replaceAll(
    replacedText,
    '<h2>`git diff --shortstat "@{0 day ago}"`</h2>',
    '## `git diff --shortstat "@{0 day ago}"`'
  );
  replacedText = replaceAll(replacedText, `2797" >`, `2797" />`);
  replacedText = replaceAll(replacedText, `springboard!</h3>`, `springboard!`);

  return replacedText;
}

async function createCategoryFolders() {
  const parentCategories = await getCategories(0);

  // const getCategory = await categoryGetter();
  await fs.mkdir(`./src/posts/`, { recursive: true });
  // loop over each post and make a folder for them

  for (const category of parentCategories) {
    const categoryFolder = getFolder(category.name);
    const categoryFolderPath = `./src/posts/${categoryFolder}`.trim();

    // 1. Make a folder for the category
    await fs.mkdir(categoryFolderPath, { recursive: true });

    const artistsInCategory = await getCategories(category.id);

    for (const artist of artistsInCategory) {
      const artistFolder = getFolder(artist.name);
      const artistFolderPath = `./src/posts/${categoryFolder}/${artistFolder}`.trim();

      // 1. Make a folder for the category
      await fs.mkdir(artistFolderPath, { recursive: true });

      const postsByArtists = await getPostsByArtist(artist.id);

      for (const post of postsByArtists) {
        const postFolder = getFolder(post.title.rendered);
        const postFolderPath = `./src/posts/${categoryFolder}/${artistFolder}/${postFolder}`.trim();

        // 1. Make a folder for the category
        await fs.mkdir(postFolderPath, { recursive: true });

        const contentWithBackticks = replacify(post.content.rendered);

        console.log('Fetching ', postFolder);
        const content = `---
title: ${postFolder}
slug: ${post.slug}
category: 
- ${category.name}
artist: ${artist.name}
date: ${post.date}
id: ${post.id}
---

${contentWithBackticks}
`.trim();
        await fs.writeFile(`${postFolderPath}/${postFolder}.mdx`, content, {
          encoding: 'utf-8',
        });
        // Fetch Featured Image
        if (post.jetpack_featured_media_url) {
          // 4. Download the feature image for each one
          const imageData = await fetch(
            post.jetpack_featured_media_url
          ).then(res => res.buffer());
          await fs.writeFile(
            `${postFolderPath}/${getImageName(
              post.jetpack_featured_media_url
            )}`,
            imageData
          );
        }
      }
    }
  }
}

async function go() {
  await createCategoryFolders();

  // const posts = await getPostsByCategory();
  // for (const post of posts) {
  //   const title = Html5Entities.decode(post.title.rendered)
  //     .trim()
  //     .replace(':', ' - ');
  //   const folder = title.replace(/[^A-Za-z0-9 \-:]/g, '');
  //   const folderPath = `./src/posts/${folder}`.trim();
  //   // const imgs = findImagePaths(post.content);
  // }
}

go();
