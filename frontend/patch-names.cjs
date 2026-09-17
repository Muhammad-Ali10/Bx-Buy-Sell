const fs = require("fs");
const patch = (file, pairs) => {
  let src = fs.readFileSync(file, "utf8");
  for (const [from, to] of pairs) {
    if (!src.includes(from)) {
      console.log("NOT FOUND in " + file + ": " + from.split("\n")[0].trim().slice(0, 70));
      process.exitCode = 1;
      continue;
    }
    src = src.replace(from, to);
  }
  fs.writeFileSync(file, src);
  console.log("patched " + file);
};

const WINDOW = "src/components/admin/chat/AdminChatWindow.tsx";
patch(WINDOW, [
  [`          {/* "3 Members, 1 online" was two hard-coded numbers with a TODO
              beside them — the same figures on every conversation, whoever was
              actually there. The draft asks for the two names here, each opening
              that person's record. */}`,
`          {/* "3 Members, 1 online" was two hard-coded numbers with a TODO
              beside them — the same figures on every conversation, whoever was
              actually there. The two names stood here next, until the client
              asked for them on the right instead: the Details panel names both
              people, and each opens that person's record. */}`],
  [`            <span className="mr-1.5">Chat History</span>
            {conversation.user?.id && (
              <>
                <span className="mx-1">·</span>
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-black transition-colors"
                  onClick={() => navigate(\`/admin/users/\${conversation.user.id}\`)}
                  title={\`Open \${buyerName}\`}
                >
                  {buyerName}
                </button>
              </>
            )}
            {conversation.seller?.id && (
              <>
                <span className="mx-1">↔</span>
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-black transition-colors"
                  onClick={() => navigate(\`/admin/users/\${conversation.seller.id}\`)}
                  title={\`Open \${sellerName}\`}
                >
                  {sellerName}
                </button>
              </>
            )}`,
`            Chat History`],
]);

const DETAILS = "src/components/admin/chat/AdminChatDetails.tsx";
patch(DETAILS, [
  ['import { useNavigate } from "react-router-dom";', 'import { Link, useNavigate } from "react-router-dom";'],

  [`interface AdminChatDetailsProps {`,
`/**
 * A person's name, opening their record.
 *
 * The client asked for the names here rather than at the top of the chat,
 * where they used to sit above the conversation.
 */
const MemberLink = ({ id, name }: { id?: string | null; name: string }) =>
  id ? (
    <Link
      to={\`/admin/users/\${id}\`}
      title={\`Open \${name}\`}
      className="hover:underline underline-offset-2"
    >
      {name}
    </Link>
  ) : (
    <>{name}</>
  );

interface AdminChatDetailsProps {`],

  [`          {[...participants, ...teamMembers].map((participant, i, everyone) => (
            <Avatar
              key={participant.id}
              className="border-2 border-white"
              style={{
                width: '48px',
                height: '48px',
                marginLeft: i > 0 ? '-8px' : '0',
                zIndex: everyone.length - i,
              }}
            >
              <AvatarImage src={participant.avatar_url} />
              <AvatarFallback style={{ fontSize: '16px' }}>
                {participant.full_name?.charAt(0) || participant.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            ))}`,
`          {[...participants, ...teamMembers].map((participant, i, everyone) => {
            const picture = (
              <Avatar
                className="border-2 border-white"
                style={{
                  width: '48px',
                  height: '48px',
                  marginLeft: i > 0 ? '-8px' : '0',
                  zIndex: everyone.length - i,
                }}
              >
                <AvatarImage src={participant.avatar_url} />
                <AvatarFallback style={{ fontSize: '16px' }}>
                  {participant.full_name?.charAt(0) || participant.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            );
            // The picture opens the same record as the name beneath it.
            return participant.id ? (
              <Link
                key={participant.id}
                to={\`/admin/users/\${participant.id}\`}
                title={\`Open \${participant.full_name || participant.email || 'this member'}\`}
                className="rounded-full"
              >
                {picture}
              </Link>
            ) : (
              <span key={\`unknown-\${i}\`}>{picture}</span>
            );
          })}`],

  [`          {participants.map((p: any) => p.full_name || p.email || 'Unknown').join('  ←→  ')}`,
`          {participants.map((p: any, i: number) => (
            <span key={p.id || \`participant-\${i}\`}>
              {i > 0 && '  ←→  '}
              <MemberLink id={p.id} name={p.full_name || p.email || 'Unknown'} />
            </span>
          ))}`],

  [`            Team: {teamMembers.map((member) => member.full_name || 'Team member').join(', ')}`,
`            Team:{' '}
            {teamMembers.map((member, i) => (
              <span key={member.id || \`team-\${i}\`}>
                {i > 0 && ', '}
                <MemberLink id={member.id} name={member.full_name || 'Team member'} />
              </span>
            ))}`],
]);
