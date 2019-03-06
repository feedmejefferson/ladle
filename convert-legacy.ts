import { FoodPhoto } from './food-photo';

import fs from 'fs';
import { bindNodeCallback, pipe } from 'rxjs';
import { map, tap, flatMap, take, share, zip } from 'rxjs/operators';
import cheerio from 'cheerio';

const filesInDir$ = bindNodeCallback(fs.readdir);
const readFile$ = bindNodeCallback(fs.readFile);
const writeFile$ = bindNodeCallback(fs.writeFile);

export function convert(source: string, target: string) {

    // define a pipe for extracting attribution details
    const attribute = () => pipe(
        map(img => source + '/attributions/' + img + '.txt'),   // map img file name to attribution file path
        flatMap(f => readFile$(f)),  // unnest the new observable created by readFile$
        map((b => cheerio.load(b.toString()))),  // convert the buffer to a string and parse it
        map($ => ({
          author: $('a:nth-of-type(2)').attr('href'),
          authorProfileUrl: $('a:nth-of-type(2)').text(),
          originTitle: $('a:nth-of-type(1)').text(),
          originUrl: $('a:nth-of-type(1)').attr('href'),  
          license: $('a:nth-of-type(3)').text(),
          licenseUrl: $('a:nth-of-type(3)').attr('href')  
        })),
    );

    // define a pipe for extracting tags and reformatting to our tagged food array
    const tag = () => pipe(
        map(img => source + '/tags/' + img + '.txt'),   // map img file name to attribution file path
        flatMap(f => readFile$(f)),  // unnest the new observable created by readFile$
        map(buf => buf.toString().trim().toLowerCase().split(',')),  // convert the buffer to a string and parse it
        map(arr => ({foods: [ { secondaryFoodTags: arr }]}))
    );

    // define a pipe for returning an object with the image name itself
    const img = () => pipe(
        map(img => ({image: img}))
    );

    /*
      We don't really need to branch and merge three separate pipes in this case.
      Instead we could simply create an object, decorate it with the image property
      as the original input value, use that value to read attributions and decorate
      the object accordingly, then do the same for the tags, but this seemed like a nice
      pattern to play around with and maintain totally independent streams withouth having
      to hang on to the original image file name in a separate closure.
    */

    // spin through all the files and process them
    const shareable$ = filesInDir$(source + '/images').pipe(
        flatMap(x => x),   // flatten the list of files to individual files
        share()  // multicast to all the pipes before zipping back together
    );
    
    shareable$.pipe(
        img(),
        zip(shareable$.pipe(attribute()), shareable$.pipe(tag())),
        map(arr => ({...arr[0], ...arr[1], ...arr[2]})), // merge the zipped objects
    ).subscribe(
        x => writeFile$(target + '/' + x.image, JSON.stringify(x)).subscribe()
    );

}

