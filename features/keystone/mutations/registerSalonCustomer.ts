import { graphql } from '@keystone-6/core';
import type { Context } from '.keystone/types';
import { serializableWorkflow } from './serializableWorkflow';

/** New identity only. Never claim a guest booking, existing User or Client by email. */
export const registerSalonCustomer = graphql.field({
  type: graphql.nonNull(graphql.Boolean),
  args: {
    name: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    email: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    password: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    phone: graphql.arg({ type: graphql.String }),
  },
  async resolve(_root, args, context: Context) {
    if (context.session) throw new Error('Sign out before creating an account');
    const name = args.name.trim(), email = args.email.trim().toLowerCase(), phone = args.phone?.trim() || "";
    if (phone.length > 40) throw new Error('Phone number is too long');
    if (!name || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || args.password.length < 12 || args.password.length > 128) throw new Error('Enter a name, valid email and a password of 12–128 characters');
    await serializableWorkflow(context, 'salon-customer-registration', [email], async tx => {
      // Public authority is only creation of a NEW unprivileged identity and empty profile.
      const sudo = tx.sudo();
      if (await sudo.query.User.count({ where: { email: { equals: email, mode: 'insensitive' } } })) throw new Error('Account could not be created. Sign in or contact the salon.');
      // Fresh-install setup must remain exclusive to the initial-owner flow.
      if (await sudo.query.User.count() === 0) throw new Error('Salon setup is not complete');
      const user = await sudo.query.User.createOne({ data: { name, email, phone, password: args.password, onboardingStatus: 'dismissed' }, query: 'id' });
      await sudo.query.Client.createOne({ data: { user: { connect: { id: user.id } } }, query: 'id' });
    });
    return true;
  },
});
