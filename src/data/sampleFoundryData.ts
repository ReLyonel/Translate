export const SAMPLE_FOUNDRY_ITEM = {
  "_id": "dnd2024Spell0001",
  "name": "Warding Bond",
  "type": "spell",
  "img": "icons/magic/defensive/shield-barrier-glowing-blue.webp",
  "system": {
    "description": {
      "value": "<p>You touch another willing creature and create a mystic connection between you until the spell ends. While the target is within 60 feet of you, it gains a +1 bonus to <strong>Armor Class</strong> and <strong>saving throws</strong>, and it has <strong>resistance</strong> to all damage. Also, each time it takes damage, you take the same amount of damage.</p><p>The spell ends if you drop to 0 <strong>hit points</strong> or if you and the target become separated by more than 60 feet. Make an attack roll or saving throw reference: @UUID[Compendium.dnd5e.spells.Item.wardingbond123]. Damage bonus roll: [[/roll 1d8 + 3 # Healing]].</p>",
      "chat": ""
    },
    "source": {
      "custom": "Player's Handbook 2024 / SRD 5.2.1",
      "book": "PHB 2024",
      "page": "337",
      "license": "CC-BY-4.0"
    },
    "activation": {
      "type": "action",
      "cost": 1,
      "condition": ""
    },
    "duration": {
      "value": "1",
      "units": "hour"
    },
    "target": {
      "value": 1,
      "width": null,
      "units": "",
      "type": "creature"
    },
    "range": {
      "value": null,
      "long": null,
      "units": "touch"
    },
    "uses": {
      "value": null,
      "max": "",
      "per": null,
      "recovery": ""
    },
    "level": 2,
    "school": "abj",
    "materials": {
      "value": "a pair of platinum rings worth at least 50 gp each",
      "consumed": false,
      "cost": 50,
      "supply": 0
    },
    "preparation": {
      "mode": "prepared",
      "prepared": false
    },
    "actionType": "util",
    "formula": "1d8 + 3"
  },
  "flags": {
    "dnd5e": {
      "itemMacro": {
        "isMacro": true
      }
    }
  },
  "_stats": {
    "systemId": "dnd5e",
    "systemVersion": "3.1.2",
    "coreVersion": "11.315",
    "createdTime": 1714500000000,
    "modifiedTime": 1714500000000,
    "lastModifiedBy": "usrAdmin00000001"
  },
  "folder": null,
  "sort": 100000,
  "ownership": {
    "default": 0
  }
};

export const SAMPLE_FOUNDRY_JOURNAL = {
  "_id": "journalDnd202401",
  "name": "Combat Rules & Features: Advantage and Saving Throws",
  "pages": [
    {
      "name": "Mechanical Advantage",
      "type": "text",
      "title": {
        "show": true,
        "level": 1
      },
      "text": {
        "content": "<p>Whenever you make an <strong>attack roll</strong> or an <strong>ability check</strong>, you might have advantage or disadvantage. When you have <strong>advantage</strong>, you roll a second d20 and use the higher roll. When you have <strong>disadvantage</strong>, use the lower roll.</p><p>For character progression, each class grants a distinct <strong>feature</strong> at key levels. You can also acquire a new <strong>feat</strong> or improve a <strong>skill</strong> when taking an Ability Score Improvement.</p><p>Reference spell: @UUID[Compendium.dnd5e.spells.Item.curewounds999]{Cure Wounds}. Rolling test: [[/roll 1d20 + @prof]].</p>"
      },
      "_id": "page000000000001",
      "system": {},
      "sort": 100000
    }
  ],
  "folder": null,
  "sort": 200000,
  "ownership": {
    "default": 0
  },
  "_stats": {
    "systemId": "dnd5e",
    "systemVersion": "3.1.2",
    "coreVersion": "11.315",
    "createdTime": 1714500000000,
    "modifiedTime": 1714500000000,
    "lastModifiedBy": "usrAdmin00000001"
  }
};
