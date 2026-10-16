import { isAxiosError } from 'axios'

// Pull the server's error message out of an API error
export default function getErrorMessage(err: unknown): string {
    if (isAxiosError(err) && err.response?.data?.error) {
        return err.response.data.error
    }
    return 'Something went wrong. Please try again.'
}
