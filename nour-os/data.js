// Static reference data. Macros per 100 g: [kcal, protein, carbs, fat]. u = handy unit [label, grams]. life = days it lasts in the fridge.
export const ING = {
  chicken:{n:'Chicken breast, cooked',m:[165,31,0,3.6],life:4},
  chickenraw:{n:'Chicken breast, raw',m:[120,22.5,0,2.6],life:2},
  beef:{n:'Lean ground beef, 90% raw',m:[176,20,0,10],life:2},
  fish:{n:'White fish, raw',m:[90,19,0,1.5],life:2},
  tuna:{n:'Tuna in water',m:[116,26,0,1],u:['can',120]},
  rice:{n:'Rice, cooked',m:[130,2.7,28,.3],u:['½ cup',90],life:4},
  vermicelli:{n:'Vermicelli, dry',m:[360,12,74,1.5],u:['tbsp',10]},
  pasta:{n:'Pasta, dry',m:[360,13,74,1.5],u:['portion',75]},
  greekyog:{n:'Greek yogurt 0%',m:[59,10,3.6,.4],u:['tbsp',15],life:10},
  whey:{n:'Protein powder',m:[400,80,10,6],u:['scoop',30]},
  berries:{n:'Berries, frozen',m:[50,.7,12,.3],u:['½ cup',75]},
  cucumber:{n:'Cucumber',m:[15,.7,3.6,.1],u:['1 small',100],life:6},
  tomato:{n:'Tomato',m:[18,.9,3.9,.2],u:['1 medium',120],life:6},
  greens:{n:'Leafy greens',m:[20,2,3,.3],u:['cup',30],life:4},
  pickles:{n:'Pickles',m:[12,.5,2.3,.3],life:60},
  oliveoil:{n:'Olive oil',m:[884,0,0,100],u:['tsp',5]},
  egg:{n:'Egg',m:[143,12.6,.7,9.5],u:['egg',50],life:21},
  tahini:{n:'Tahini',m:[595,17,21,54],u:['tbsp',15]},
  pita:{n:'Pita, whole wheat',m:[266,9.8,55,2.6],u:['small pita',60],life:5},
  labneh:{n:'Labneh',m:[160,7,4,13],u:['tbsp',20],life:10},
  protbread:{n:'Protein bread',m:[250,13,40,4],u:['slice',40],life:7},
  pb:{n:'Peanut butter',m:[588,25,20,50],u:['tbsp',16]},
  oats:{n:'Oats',m:[389,17,66,7],u:['¼ cup',20]},
  banana:{n:'Banana',m:[89,1.1,23,.3],u:['banana',118],life:5},
  apple:{n:'Apple',m:[52,.3,14,.2],u:['apple',180],life:14},
  fruit:{n:'Fruit',m:[55,.6,14,.2],u:['piece',150],life:6},
  avocado:{n:'Avocado',m:[160,2,9,15],u:['¼ avocado',50],life:3},
  mixedveg:{n:'Mixed vegetables',m:[65,3,13,.5],u:['cup',140]},
  lentils:{n:'Lentils, cooked',m:[116,9,20,.4],u:['cup',200],life:4},
  chickpeas:{n:'Chickpeas, cooked',m:[164,9,27,2.6],u:['cup',160],life:4},
  potato:{n:'Potato',m:[77,2,17,.1],u:['medium',170]},
  halloumi:{n:'Halloumi',m:[321,22,2,25],u:['slice',30],life:14},
  almonds:{n:'Almonds, sliced',m:[579,21,22,50],u:['tbsp',7]},
  milk:{n:'Milk 1%',m:[42,3.4,5,1],u:['cup',250],life:7},
  cheese:{n:'Cheese slice',m:[330,20,6,25],u:['slice',20],life:14},
  hummus:{n:'Hummus',m:[166,8,14,10],u:['tbsp',15],life:6},
  parmesan:{n:'Parmesan',m:[431,38,4,29],u:['tbsp',5]}
};

export const DEFAULT_RECIPES = [
  {id:'yogbowl',n:'Protein yogurt bowl',icon:'🥣',serv:1,ings:[{i:'greekyog',q:200,u:'g'},{i:'whey',q:1,u:'unit'},{i:'berries',q:1,u:'unit'}],how:'Stir the scoop into the yogurt, top with berries. 2 minutes.'},
  {id:'chickbowl',n:'Chicken shawarma bowl',icon:'🍗',serv:1,ings:[{i:'chicken',q:150,u:'g'},{i:'rice',q:1,u:'unit'},{i:'cucumber',q:80,u:'g'},{i:'tomato',q:80,u:'g'},{i:'pickles',q:30,u:'g'},{i:'greekyog',q:2,u:'unit'},{i:'oliveoil',q:1,u:'unit'}],
    how:'Toss 1 kg chicken with shawarma spice, garlic, lemon and 1 tbsp oil. Bake at 220°C for 22 min, then slice. Bowl = chicken, rice, cucumber, tomato, pickles, garlic yogurt.'},
  {id:'beefbowl',n:'Beef bowl',icon:'🥩',serv:1,ings:[{i:'beef',q:120,u:'g'},{i:'rice',q:1,u:'unit'},{i:'cucumber',q:80,u:'g'},{i:'tomato',q:80,u:'g'},{i:'pickles',q:30,u:'g'},{i:'greekyog',q:2,u:'unit'}],
    how:'Brown lean beef with onion, 7 spices and cumin. No oil needed. Same bowl as the chicken.'},
  {id:'eggs2',n:'2 boiled eggs',icon:'🥚',serv:1,ings:[{i:'egg',q:2,u:'unit'}],how:'Boil 10 on Sunday, 9 minutes.'},
  {id:'apple',n:'Apple',icon:'🍎',serv:1,ings:[{i:'apple',q:1,u:'unit'}]}
];

export const DEFAULT_PLAN = { // weekday -> {B,L,D,S} recipe ids
  1:{B:'yogbowl',L:'chickbowl',D:'beefbowl',S:'eggs2'}, 2:{B:'yogbowl',L:'chickbowl',D:'chickbowl',S:'apple'},
  3:{B:'yogbowl',L:'beefbowl',D:'chickbowl',S:'eggs2'}, 4:{B:'yogbowl',L:'chickbowl',D:'beefbowl',S:'apple'},
  5:{B:'yogbowl',L:'chickbowl',D:'chickbowl',S:'eggs2'}, 6:{B:'yogbowl',L:'beefbowl',D:'',S:'apple'}, 0:{B:'yogbowl',L:'',D:'',S:''}
};

export const ZONES = {
  fridge:{n:'Fridge',food:true,life:7}, freezer:{n:'Freezer',food:true,life:120},
  spices:{n:'Spice cabinet',food:true,life:0}, abovehood:{n:'Above the hood',food:true,life:0},
  pantry:{n:'Snack cabinet',food:true,life:0}, abovefridge:{n:'Above the fridge',food:false,life:0}, cups:{n:'Cups & pans',food:false,life:0}
};

export const WORKOUTS = {
  d1:{name:'Glutes · Heavy',short:'Glutes heavy',ex:[
    {id:'ht',n:'Hip thrust (Smith)',sets:4,rx:'8 / 8 / 6 / 6',start:'Start 25+25 per side, build to 45+45'},
    {id:'rdl',n:'Romanian deadlift',sets:3,rx:'8–10',start:'Start 25+25 per side'},
    {id:'bss',n:'Bulgarian split squat',sets:3,rx:'8 each leg',start:'10–15 lb dumbbells'},
    {id:'kick',n:'Cable kickback',sets:3,rx:'12–15, slow',start:''},
    {id:'abd',n:'Abduction',sets:3,rx:'15–20, burn out',start:''}],
    tip:'Keep your starting weights for the first 2 weeks back. Add 5 lb per side on hip thrust only when every rep is clean.'},
  d2:{name:'Upper · Sculpt',short:'Upper',ex:[
    {id:'apu',n:'Assisted pull-up',sets:3,rx:'10–15 total reps',start:''},
    {id:'lpd',n:'Lat pulldown',sets:3,rx:'10–12',start:'15–25'},
    {id:'row',n:'Seated row',sets:3,rx:'10–12',start:'Moderate'},
    {id:'sp',n:'Shoulder press',sets:3,rx:'10',start:'~15 lb'},
    {id:'lat',n:'Lateral raise',sets:3,rx:'12–15, light and slow',start:''},
    {id:'arms',n:'Triceps + biceps',sets:3,rx:'2–3 sets each',start:''}],
    tip:'Wider lats and capped shoulders make your waist look smaller. This is the hourglass day.'},
  d3:{name:'Glutes · Volume',short:'Glutes volume',ex:[
    {id:'ht2',n:'Hip thrust (lighter)',sets:3,rx:'12–15',start:'Lighter than Monday'},
    {id:'step',n:'Step-up (glute bias)',sets:3,rx:'10 each leg',start:''},
    {id:'rdl2',n:'RDL (lighter)',sets:3,rx:'10–12',start:''},
    {id:'kick2',n:'Cable kickback',sets:3,rx:'12–15',start:''},
    {id:'abd2',n:'Abduction',sets:3,rx:'20',start:''}],
    tip:'Lean forward and drive through the heel on step-ups so glutes do the work, not quads.'},
  d4:{name:'Core + Light Glutes',short:'Core',ex:[
    {id:'apu2',n:'Assisted pull-up practice',sets:3,rx:'Easy reps',start:''},
    {id:'hkr',n:'Hanging knee raise',sets:3,rx:'8–12',start:''},
    {id:'cc',n:'Cable crunch',sets:3,rx:'12–15',start:''},
    {id:'plank',n:'Plank',sets:2,rx:'30–45 s',start:''},
    {id:'lg',n:'Light glutes (bands)',sets:2,rx:'Easy',start:''},
    {id:'walk',n:'Incline walk',sets:1,rx:'15–20 min',start:''}],
    tip:'Optional. Only if you feel good.'}
};

export const DEFAULT_SCHEDULE = {
  0:[], 1:[{t:'gym',w:'d1'}], 2:[{t:'class',n:'Bungee'}], 3:[{t:'class',n:'Antigravity'}],
  4:[{t:'gym',w:'d2'}], 5:[{t:'gym',w:'d3'}], 6:[{t:'gym',w:'d4',opt:true}]
};

export const SYMPTOMS = ['Cramps','Bloating','Headache','Cravings','Acne','Tender','Tired','Moody','Anxious','Great'];
export const PHASES = {
  menstrual:{n:'Period',tip:'Lighter weights are fine. Eat iron: red meat, lentils, spinach.',c:'rose'},
  follicular:{n:'Follicular',tip:'Energy is rising. Good week to push heavier lifts.',c:'mint'},
  ovulation:{n:'Ovulation',tip:'Usually your strongest days. Go for a hip thrust PR.',c:'lilac'},
  luteal:{n:'Luteal',tip:'Hunger can rise 100–300 kcal and the scale holds water. Keep protein high and don’t judge the scale this week.',c:'amber'}
};
