# creative-coding

Weekly creative coding sketches — one project per week.

## Structure

```
creative-coding/
├── index.html          home page (requires local server)
├── projects.json       manifest — source of truth for the home page
├── projects/           one subfolder per sketch
│   └── YYYY-WNN-slug/  self-contained, opened directly in browser
├── templates/          starter skeletons: p5 | three | webgpu | vanilla
└── scripts/new.sh      scaffold a new weekly sketch
```

## Starting a new sketch

```bash
./scripts/new.sh "Title" [p5|three|webgpu|vanilla]
```

This:
1. Copies the template into `projects/YYYY-WNN-slug/`
2. Updates `projects.json`
3. Creates a journal entry in `Synapse/calendar notes/creative coding journal/YYYY/Week NN/`

## Running locally

```bash
npm start   # → http://localhost:3000
```

## Adding a description

Edit `projects.json` and fill in the `description` field for the project.
The home page will show it in the card.

## Journal

`Synapse/calendar notes/creative coding journal/YYYY/Week NN/YYYY-WNN.md`
