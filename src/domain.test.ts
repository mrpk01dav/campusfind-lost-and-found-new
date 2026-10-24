import {describe,it,expect} from 'vitest';
import {demoItems,findMatches,scoreMatch,searchItems,validItemInput,type Item} from './domain';
const lost:Item={id:'l',type:'lost',title:'Blue notebook',category:'Books & Notes',description:'Blue ruled notebook near study tables',color:'Blue',location:'Central Library',date:'2026-10-22',status:'Open',owner:'test',handover:false,createdAt:'2026-10-22T00:00:00Z'};
const found:Item={...lost,id:'f',type:'found',title:'Notebook found',description:'Ruled blue notebook found by study tables',createdAt:'2026-10-22T01:00:00Z'};
describe('CampusFind domain logic',()=>{
 it('scores matching lost/found reports and explains overlapping attributes',()=>{const result=scoreMatch(lost,found);expect(result.score).toBeGreaterThanOrEqual(80);expect(result.reasons).toContain('Category');expect(result.reasons).toContain('Location')});
 it('does not match reports of the same type',()=>expect(scoreMatch(lost,{...found,type:'lost'}).score).toBe(0));
 it('handles missing attributes without NaN',()=>{const result=scoreMatch({...lost,color:'',location:'',date:''},{...found,color:'',location:'',date:''});expect(Number.isFinite(result.score)).toBe(true)});
 it('finds reciprocal candidates but excludes closed records',()=>{expect(findMatches(lost,[lost,found]).some(m=>m.item.id==='f')).toBe(true);expect(findMatches(lost,[lost,{...found,status:'Closed'}])).toHaveLength(0)});
 it('searches title, description, category, color and location',()=>{expect(searchItems(demoItems,'library','all','all','all').length).toBeGreaterThan(0);expect(searchItems(demoItems,'silver','all','all','all').length).toBeGreaterThan(0)});
 it('filters by type/category/status',()=>{expect(searchItems(demoItems,'','lost','all','all').every(i=>i.type==='lost')).toBe(true);expect(searchItems(demoItems,'','all','Keys','all').every(i=>i.category==='Keys')).toBe(true)});
 it('validates required fields and rejects future dates',()=>{expect(Object.keys(validItemInput({})).length).toBeGreaterThan(0);expect(validItemInput({...lost,date:'2999-01-01'}).date).toBe('Date cannot be in the future.')});
 it('accepts a valid report draft',()=>{expect(validItemInput(lost)).toEqual({})});
});
