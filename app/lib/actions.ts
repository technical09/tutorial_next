'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const FormSchema=z.object({
    id: z.string(),
    customerId: z.string({
      invalid_type_error: 'Por favor, selecciona un cliente.',
    }),
    amount: z.coerce
      .number()
      .gt(0, {message: 'Por favor, introduce una cantidad mayor de $0'}),
    status: z.enum(['pending', 'paid'],{
      invalid_type_error: 'Por favor, selecciona un estado de la factura.',
    }),
    date: z.string(),
});

const CreateInvoice=FormSchema.omit({id: true, date: true});
const UpdateInvoice=FormSchema.omit({id: true, date:true});

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?:string|null;
}


export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFields = CreateInvoice.safeParse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
  });

  if(!validatedFields.success){
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Faltan campos. Fallo al crear la factura.',
    }
  }
  const { customerId, amount, status } = validatedFields.data;
  const aumountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try{
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${aumountInCents}, ${status}, ${date})
    `;
  }catch(error){
    return {
      message: 'Error BD: Fallo al crear la Factura.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
  }

export async function updateInvoice(id: string, formData: FormData){
  const {customerId, amount, status } = UpdateInvoice.parse({
    customerId:formData.get('customerId'),
    amount:formData.get('amount'),
    status:formData.get('status'),
  }) ;

  const aumountInCents=amount*100;

  try{
    await sql`
      UPDATE invoices
      SET customer_id=${customerId}, amount= ${aumountInCents}, status=${status}
      WHERE id=${id}
    `;
  } catch (error){
    return {
      message:'Error BD: Fallo al actualizar Factura.'
    };
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string){
  throw new Error('Failed to Delete Invoice');
  try{
    await sql`DELETE FROM invoices WHERE id=${id}`; 
    revalidatePath('/dashboard/invoices');
  }catch(error){
    return {
      message: 'Error BD: No se pudo elimiar la Factura.'
    };
  }
}

export async function authenticate(
  prevState: string|undefined,
  formData: FormData,
){
  try{
    await signIn('credentials', formData);
  }catch(error){
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Credenciales erróneas.';
        default:
          return 'Ha ocurrido algún error.';
      }
    }
    throw error;
  }
}