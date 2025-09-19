export async function defaultGetServerSideProps(context) {
    const isSandbox = process.env.SANDBOX == 'true';
    // Fetch other data if needed
    return { props: { isSandbox } };
}
