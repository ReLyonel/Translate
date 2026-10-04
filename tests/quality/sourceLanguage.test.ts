import {expect,it} from 'vitest';
import {sourceLanguage} from '../../src/services/translation/languageDetector';

it.each([
 ['<p>Меч @UUID[Item.abc]</p>','ru'],
 ['<p>The actor can make an attack.</p>','en'],
 ['Sword','en'],
 ['<span title="Меч">The actor can attack.</span>','en'],
 ['Мультиатака','ru'],
 ['Київ',undefined],
 ['Sword Меч',undefined],
 ['Vampiro',undefined],
 ['El actor puede atacar con una espada.',undefined],
 ['AC',undefined],
 ['@UUID[Actor.Меч]',undefined],
 ['[[1d20+5]]',undefined],
 ['Alice',undefined],
] as const)('detects human prose conservatively: %s', (source,expected)=>expect(sourceLanguage(source)).toBe(expected));

it('manual EN/RU selection is authoritative, including short proper names',()=>{
 expect(sourceLanguage('Alice','en')).toBe('en');expect(sourceLanguage('Alice','ru')).toBe('ru');
});
