# Footbooker
Script to book football

## To get started:
`npm run setup`

## To test:
`npm test`

## To use:
1. Modify settings file "settings/foot_booker_settings.json" to include your custom settings
2. Run `npm start`
3. As a suggestion, add a cron job to run it near midnight
    1. `crontab -e`
    2. Add to the file: "59 23 * * * npm start --prefix /path/to/footbooker/"