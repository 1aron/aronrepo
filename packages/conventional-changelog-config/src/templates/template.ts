import dedent from 'dedent'

export default /* html */ dedent`
    {{#each commitGroups}}
        {{#if title}}
            ### {{title}}

        {{/if}}
        {{#each commits}}
            {{> commit root=@root}}
        {{/each}}

    {{/each}}
    {{> footer}}
`