# Footbooker
Script to book football

## To get started:
`npm run setup`

## To test:
`npm test`

## To use:
1. Either modify settings file "settings/foot_booker_settings.json" to include your custom settings or copy it and create a new settings file.
2. Run `npm start` (for default settings file) or `npm start -- path/to/settings/file` (if not default settings file).
3. As a suggestion, add a cron job to run it near midnight
    1. `crontab -e`
    2. Add to the file: "59 23 * * * npm start --prefix /path/to/footbooker/ (-- path/to/settings/file)"