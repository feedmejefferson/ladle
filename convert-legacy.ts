import { FoodPhoto } from './food-photo';

import fs from 'fs';
import { bindNodeCallback, pipe, range, of, forkJoin } from 'rxjs';
import { map, tap, flatMap, take, share, zip, delay } from 'rxjs/operators';
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
            title: $('a:nth-of-type(1)').text(),
            description: $('a:nth-of-type(1)').text(),
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
        map(arr => ({ containsTags: arr }))
    );

    // define a pipe for returning an object with the image name itself
    const img = () => pipe(
        map(img => ({id: img})),

    );

    // spin through all the files and process them
    filesInDir$(source + '/images').pipe(
        flatMap(x=>x),  // unnest the files
        flatMap(x=>forkJoin(    // join up the attributes from different files
            of(x).pipe(img()),
            of(x).pipe(attribute()),
            of(x).pipe(tag())
        )),
        map(arr => ({...arr[0], ...arr[1], ...arr[2]})), // merge the joined objects
        take(10),
        tap(x=>console.log(x))
        ).subscribe(
            x => writeFile$(target + '/' + x.id, JSON.stringify(x)).subscribe()
        );
    }

