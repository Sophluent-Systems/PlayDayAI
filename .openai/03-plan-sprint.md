<goal>
Create a sprint plan to implement one epic from the TDD.
</goal>

<process>
1. *Choose the next incomplete epic from the TDD and mark it as in-progress*
    - Identify the next TDD epic and markt it as "in-progress" with this: emoji (⚠️).
    - If prior epics are actually complete and haven't been updated, mark them with a green check emoji.


2. *Summarize the story in context of the overall epic, including what should be "testable" by the end of the sprint*
    - Following agile principles, there should be user-facing functionality that is verifyable by the product champion at the end of the sprint. Add a section to the document describing 1) What a product champion will be able to do test once this story is implemented; 2) what data will power the functionality in this story (real data or mock data),  3) How the feature can be verified by a human (e.g. a user journey, or commands that can be run to execute tests, etc); 4) acceptance criteria of done-ness
    - If only temporary mock data and/or mock functions will be put in place to allow this feature to be verified in this sprint, then edit the TDD to add stories in the future to remove the temporary mocks when real data/functions are integrated with this code

3. *Summarize key "rules" for engineering this codebase"*
    - Create a section with key instructions for developers implementing the code
    - This should be a list bullet points (maybe 10-20), cogently expressing key rules and guidelines
    - These guidelines could include things like:
        * Rules about where "imports" go (types, interfaces, etc)
        * Rules about where to put files
        * Rules about design patterns that are allowed and disallowed
        * Rules about what data allowed outside an interface, and what data is considered internal or private
        * Rules that apply to security
        * Rules that apply to performance
        * Rules that apply to external interfaces being called
        * Etc ... basically anything that is not expressly said inside each story but is important to maintaining the architect's technical guidance for the project
    - Include the most important 10-20 items

3. *Write detailed, step-by-step tasks for the engineers*
    - Add a section for each story. Each story must have the following sub-sections:

    References
    - Add a section that references internal and external documentation for this story, with instructions for the developer to familiarize themselves with this information b efore starting. For example, specific sections and sub-sections of the PRD and TDD. Include file paths.
    - Include external documentation if the story involves calling APIs or web services external to the project (look up URLs for documentation ensuring the pages refer to the correct version of the API/service being called)

    Tasks
    - A list of HIGHLY detailed tasks, described in enough detail that a junior engineer could complete the task in under an hour without having to look anything up
    - Include a fine level of detail on what needs to be done such as (but not limited to):  Functions to be written, assumed data input to functions, assumed data output of funcitons, UI elements to be added, data that will be applied to each UI element, handlers for each UI element, instructions for wiring up components to existing APIs/components.
    - Provide sample code when helpful especially for interface definitions or data types

4. *Add Formatting*
    - Each story, task, and test line-item should start with a markdown empty check box [ ]
    - At the top, include the creation date, and last updated date/time
    - Add instructions to check off each completed item with a green check emoji once completed
</process>

<action>
Plan the upcoming sprint, writing the sprint plan in docs/sprint-plan.md, erasing the old content inside the document before you start.
</action>

