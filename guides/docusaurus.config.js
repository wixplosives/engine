const lightCodeTheme = require('prism-react-renderer/themes/vsLight');
const darkCodeTheme = require('prism-react-renderer/themes/vsDark');

const config = {
    title: 'Engine Docs',
    url: 'https://wixplosives.github.io/',
    baseUrl: '/engine/guides/',
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',
    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },
    presets: [
        [
            'classic',
            ({
                theme: {
                    customCss: [require.resolve('./src/css/custom.css')],
                },
                docs: {
                    routeBasePath: '/',
                    sidebarPath: require.resolve('./sidebars.js'),
                },
            }),
        ],
    ],
    markdown: {
        mermaid: true,
    },
    themes: ['@docusaurus/theme-mermaid'],
    themeConfig:
        ({
            navbar: {
                logo: {
                    alt: 'Engine Logo',
                    src: 'img/logo_light.svg',
                    srcDark: 'img/logo_dark.svg',
                },
                items: [
                    {
                        type: 'docSidebar',
                        sidebarId: 'tutorialSidebar',
                        position: 'left',
                        label: 'Docs',
                    },{
                        href: 'https://wixplosives.github.io/engine',
                        target: '_self',
                        position: 'left',
                        label: 'API Reference',
                    },
                    {
                        href: 'https://github.com/wixplosives/engine',
                        label: 'GitHub',
                        position: 'right',
                    },
                ],
            },
            footer: {
                style: 'dark',
                links: [
                    {
                        title: 'Documentation',
                        items: [
                            {
                                label: 'API Reference',
                                to: 'https://wixplosives.github.io/engine/',
                            },
                        ],
                    },
                    {
                        title: 'More',
                        items: [
                            {
                                label: 'GitHub',
                                href: 'https://github.com/wixplosives/engine',
                            },
                        ],
                    },
                ],
                copyright: `Copyright © 2006-${new Date().getFullYear()} Wix.com LTD. Built with Docusaurus.`,
            },
            prism: {
                theme: lightCodeTheme,
                darkTheme: darkCodeTheme,
            },
        }),
};

module.exports = config;
